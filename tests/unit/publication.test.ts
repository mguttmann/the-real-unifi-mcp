/**
 * Publication files: package.json, server.json (MCP Registry), the registry
 * workflow, glama.json, NOTICE and the README notices stay consistent with
 * each other and with the env vars src/config.ts reads.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const pkg = JSON.parse(read("package.json")) as {
  name: string;
  version: string;
  mcpName: string;
  files: string[];
  repository: { url: string };
  bin: Record<string, string>;
};
const server = JSON.parse(read("server.json")) as {
  $schema: string;
  name: string;
  title?: string;
  description: string;
  version: string;
  repository: { url: string; source: string };
  packages: {
    registryType: string;
    identifier: string;
    version: string;
    runtimeHint?: string;
    transport: { type: string };
    environmentVariables: {
      name: string;
      isRequired?: boolean;
      isSecret?: boolean;
      default?: string;
    }[];
  }[];
};
const configSource = read("src/config.ts");
const configEnv = [...configSource.matchAll(/env\.(UNIFI_[A-Z_]+)/g)].map((m) => m[1]!);
const registry = read(".github/workflows/mcp-registry.yml");
const release = read(".github/workflows/release.yml");

describe("package.json", () => {
  it("names the MCP Registry server and runs dist/index.js", () => {
    expect(pkg.mcpName).toBe("io.github.mguttmann/the-real-unifi-mcp");
    expect(pkg.bin).toEqual({ "the-real-unifi-mcp": "dist/index.js" });
  });

  it("ships NOTICE", () => {
    expect(pkg.files).toContain("NOTICE");
  });
});

describe("server.json (MCP Registry)", () => {
  it("matches package.json name, version, mcpName and repository", () => {
    expect(server.$schema).toMatch(
      /^https:\/\/static\.modelcontextprotocol\.io\/schemas\/\d{4}-\d{2}-\d{2}\/server\.schema\.json$/,
    );
    expect(server.name).toBe(pkg.mcpName);
    expect(server.version).toBe(pkg.version);
    expect(pkg.repository.url).toContain(server.repository.url.replace("https://", ""));
    expect(server.repository.source).toBe("github");
    expect(server.description.length).toBeLessThanOrEqual(100);
  });

  it("lists the npm package with the stdio transport", () => {
    expect(server.packages.map((p) => p.registryType)).toEqual(["npm"]);
    const [p] = server.packages;
    expect(p!.identifier).toBe(pkg.name);
    expect(p!.version).toBe(pkg.version);
    expect(p!.runtimeHint).toBe("npx");
    expect(p!.transport.type).toBe("stdio");
  });

  it("declares exactly the env vars src/config.ts reads, the API key as a required secret", () => {
    const env = server.packages[0]!.environmentVariables;
    expect(env.map((e) => e.name).sort()).toEqual([...new Set(configEnv)].sort());
    expect(env.filter((e) => e.isSecret).map((e) => e.name)).toEqual(["UNIFI_API_KEY"]);
    expect(env.filter((e) => e.isRequired).map((e) => e.name)).toEqual(["UNIFI_API_KEY"]);
  });
});

describe("server.json defaults", () => {
  it("equal src/config.ts", () => {
    const d = loadConfig({ UNIFI_API_KEY: "publication-test-dummy" });
    const byName = Object.fromEntries(
      server.packages[0]!.environmentVariables.map((e) => [e.name, e.default]),
    );
    expect(byName).toMatchObject({
      UNIFI_API_BASE: d.apiBase,
      UNIFI_CONFIRM_WRITES: String(d.confirmWrites),
      UNIFI_TIMEOUT_MS: String(d.timeoutMs),
      UNIFI_LOG_LEVEL: d.logLevel,
    });
  });
});

describe("MCP Registry workflow", () => {
  it("runs after npm-publish on stable tags and is callable by hand", () => {
    const job = release.slice(release.indexOf("\n  mcp-registry:\n"));
    expect(job).toMatch(/needs: \[[^\n]*\bnpm-publish\b/);
    expect(job).toContain("uses: ./.github/workflows/mcp-registry.yml");
    expect(job).toContain("id-token: write");
    expect(job).toContain("needs.verify.outputs.prerelease != 'true'");
    expect(job).toContain("npm-published: ${{ needs.npm-publish.result == 'success' }}");
    expect(registry).toMatch(/^ {2}workflow_call:/m);
    expect(registry).toMatch(/^ {2}workflow_dispatch:/m);
  });

  it("installs a pinned, checksum-verified mcp-publisher and logs in with GitHub OIDC", () => {
    expect(registry).toMatch(/MCP_PUBLISHER_VERSION: v\d+\.\d+\.\d+\n/);
    expect(registry).toMatch(/MCP_PUBLISHER_SHA256: [0-9a-f]{64}\n/);
    const check = registry.indexOf(
      'echo "${MCP_PUBLISHER_SHA256}  ${archive}" | sha256sum --check',
    );
    const extract = registry.indexOf("tar -xzf");
    expect(check).toBeGreaterThan(0);
    expect(extract).toBeGreaterThan(check);
    expect(registry.indexOf("./mcp-publisher login github-oidc")).toBeGreaterThan(extract);
    expect(registry.indexOf("./mcp-publisher publish")).toBeGreaterThan(extract);
    expect(registry).not.toMatch(/releases\/latest|\|\s*(ba)?sh\b/);
  });

  it("publishes only a version npm serves with the right mcpName", () => {
    expect(registry).toContain("https://registry.npmjs.org/${ident}/${version}");
    expect(registry).toContain(".mcpName // empty");
  });
});

describe("listing and legal files", () => {
  it("glama.json names the maintainer", () => {
    expect(JSON.parse(read("glama.json"))).toEqual({
      $schema: "https://glama.ai/mcp/schemas/server.json",
      maintainers: ["mguttmann"],
    });
  });

  it("NOTICE states the unofficial status, trademarks and the vendor documentation", () => {
    const notice = read("NOTICE");
    expect(notice).toMatch(/not\s+affiliated with/);
    expect(notice).toContain("trademark");
    expect(notice).toContain("tests/fixtures/openapi/");
    expect(notice).toContain("developer.ui.com");
  });

  it("README has the unofficial notice and a maintenance status section", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/unofficial/i);
    expect(readme).toMatch(/not affiliated with or endorsed by Ubiquiti/);
    expect(readme).toMatch(/^#{2,3} Maintenance status$/m);
  });
});

describe("docs/maintainers/repo-settings.md", () => {
  it("lists every CI check as required", () => {
    const ci = read(".github/workflows/ci.yml");
    const settings = read("docs/maintainers/repo-settings.md");
    const matrix = /node: \[([^\]]+)\]/.exec(ci)?.[1] ?? "";
    const nodes = [...matrix.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    expect(nodes.length).toBeGreaterThan(0);
    const checks = [...nodes.map((n) => `build (node ${n})`), "mcpb bundle"];
    expect(ci).toContain("name: build (node ${{ matrix.node }})");
    expect(ci).toContain("name: mcpb bundle");
    for (const c of checks) expect(settings).toContain(`{ "context": "${c}" }`);
  });

  it("keeps the internal audit documents out of the tree and names their history rewrite before going public", () => {
    expect(existsSync(new URL("../../docs/audit", import.meta.url))).toBe(false);
    const settings = read("docs/maintainers/repo-settings.md");
    const cleanup = settings.slice(settings.indexOf("## 8. One-time cleanup before going public"));
    expect(cleanup).toContain("git filter-repo --invert-paths --path docs/audit/");
    expect(cleanup).toContain("git log --all --oneline -- docs/audit");
  });
});
