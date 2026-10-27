/**
 * Release chain (audit N-11, N-12, N-18): the MCPB manifest follows the
 * current MCPB schema and maps its user settings to the env vars the server
 * reads, the bundle script installs from the lockfile, and the release
 * workflow keeps its gates. The full schema check runs in
 * scripts/build-mcpb.sh (`mcpb validate` from the pinned dev dependency).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOG_LEVEL } from "../../src/constants.js";
import { loadConfig } from "../../src/config.js";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

interface UserConfigEntry {
  type: string;
  title: string;
  description: string;
  required?: boolean;
  sensitive?: boolean;
  default?: unknown;
}
interface Manifest {
  manifest_version: string;
  name: string;
  version: string;
  server: {
    type: string;
    entry_point: string;
    mcp_config?: { command: string; args?: string[]; env?: Record<string, string> };
  };
  user_config?: Record<string, UserConfigEntry> | unknown[];
}

const manifest = JSON.parse(read("mcpb/manifest.json")) as Manifest;
const pkg = JSON.parse(read("package.json")) as { name: string; version: string };

describe("MCPB manifest (N-11)", () => {
  it("uses a current manifest version with an object user_config", () => {
    expect(manifest.manifest_version).toBe("0.2");
    expect(manifest.name).toBe(pkg.name);
    expect(Array.isArray(manifest.user_config)).toBe(false);
    expect(typeof manifest.user_config).toBe("object");
  });

  it("starts the bundled entry point with node", () => {
    expect(manifest.server.type).toBe("node");
    expect(manifest.server.entry_point).toBe("dist/index.js");
    expect(manifest.server.mcp_config?.command).toBe("node");
    expect(manifest.server.mcp_config?.args).toEqual(["${__dirname}/dist/index.js"]);
  });

  it("maps every user setting to an env var the server reads", () => {
    const userConfig = manifest.user_config as Record<string, UserConfigEntry>;
    const env = manifest.server.mcp_config?.env ?? {};
    const configSource = read("src/config.ts");
    const referenced = new Set<string>();
    for (const [name, value] of Object.entries(env)) {
      expect(configSource, `${name} is not read by src/config.ts`).toContain(`env.${name}`);
      const m = /^\$\{user_config\.([a-z_]+)\}$/.exec(value);
      expect(m, `${name} must map to one user_config entry`).not.toBeNull();
      referenced.add(m![1]!);
    }
    expect([...referenced].sort()).toEqual(Object.keys(userConfig).sort());
  });

  it("asks for the API key as a required secret and keeps the server defaults", () => {
    const userConfig = manifest.user_config as Record<string, UserConfigEntry>;
    const env = manifest.server.mcp_config?.env ?? {};
    const keyOf = (envName: string) => /user_config\.([a-z_]+)/.exec(env[envName] ?? "")?.[1] ?? "";

    const apiKey = userConfig[keyOf("UNIFI_API_KEY")];
    expect(apiKey).toMatchObject({ type: "string", required: true, sensitive: true });

    const defaults = loadConfig({ UNIFI_API_KEY: "dummy" });
    expect(userConfig[keyOf("UNIFI_CONFIRM_WRITES")]).toMatchObject({
      type: "boolean",
      default: defaults.confirmWrites,
    });
    expect(userConfig[keyOf("UNIFI_LOG_LEVEL")]).toMatchObject({
      type: "string",
      default: DEFAULT_LOG_LEVEL,
    });
    for (const [name, value] of [
      ["UNIFI_READ_ONLY", defaults.readOnly],
      ["UNIFI_REDACT_SECRETS", defaults.redactSecrets],
    ] as const)
      expect(userConfig[keyOf(name)], name).toMatchObject({ type: "boolean", default: value });
  });
});

describe("MCPB bundle script (N-12)", () => {
  const script = read("scripts/build-mcpb.sh");

  it("installs the runtime tree from the lockfile without install scripts", () => {
    expect(script).toContain("cp package-lock.json");
    expect(script).toContain("npm ci --omit=dev --ignore-scripts");
    expect(script).not.toMatch(/npm install/);
  });

  it("stages the same runtime files as the npm package (no code generator, no rsc parser)", () => {
    const pkg = JSON.parse(read("package.json")) as { files: string[] };
    expect(pkg.files).toContain("!dist/codegen/**");
    expect(pkg.files).toContain("!dist/client/rsc.js");
    expect(script).toContain("! -path './codegen/*'");
    expect(script).toContain("! -path './client/rsc.js'");
  });

  it("cleans up its staging directory on every exit and validates the manifest", () => {
    expect(script).toMatch(/trap .* EXIT/);
    expect(script).toContain("validate");
    expect(script).toContain("SOURCE_DATE_EPOCH");
  });

  it("validates with the MCPB CLI pinned in the lockfile, not through npx (N-75)", () => {
    const devPkg = JSON.parse(read("package.json")) as { devDependencies: Record<string, string> };
    const lock = JSON.parse(read("package-lock.json")) as {
      packages: Record<string, { version?: string }>;
    };
    const pin = devPkg.devDependencies["@anthropic-ai/mcpb"];
    expect(pin).toMatch(/^\d+\.\d+\.\d+$/);
    expect(lock.packages["node_modules/@anthropic-ai/mcpb"]?.version).toBe(pin);
    expect(script).toContain('"$ROOT/node_modules/.bin/mcpb" validate mcpb/manifest.json');
    expect(script).not.toMatch(/\bnpx\b/);
  });

  it("normalises both SBOMs to SOURCE_DATE_EPOCH and a content serial (N-74)", () => {
    expect(script).toContain('node scripts/normalize-sbom.mjs "$OUT.cdx.json"');
    expect(script).toContain(
      'node scripts/normalize-sbom.mjs "$OUT_DIR/${NAME}-${VERSION}.tgz.cdx.json"',
    );
  });
});

describe("release workflow (N-18)", () => {
  const wf = existsSync(new URL("../../.github/workflows/release.yml", import.meta.url))
    ? read(".github/workflows/release.yml")
    : "";

  it("runs on version tags only and checks tag, version and main", () => {
    expect(wf).toMatch(/tags:\s*\n\s*- "v\*\.\*\.\*"/);
    expect(wf).toContain(`"$TAG" != "v$version"`);
    expect(wf).toContain("git merge-base --is-ancestor");
  });

  it("CI checks the formatting (N-73)", () => {
    expect(read(".github/workflows/ci.yml")).toContain("- run: npm run format:check");
  });

  it("reuses the full CI on the tag commit", () => {
    expect(wf).toContain("uses: ./.github/workflows/ci.yml");
    expect(read(".github/workflows/ci.yml")).toContain("workflow_call:");
  });

  it("installs the build dependencies without install scripts (N-76)", () => {
    const job = wf.slice(wf.indexOf("\n  build:\n"), wf.indexOf("\n  github-release:\n"));
    expect(job).toContain("- run: npm ci --ignore-scripts --no-audit --no-fund");
    expect(job).not.toMatch(/- run: npm ci --no-audit/);
  });

  it("ships tarball, SBOMs and checksums and never overwrites a release", () => {
    expect(wf).toContain("npm pack");
    expect(wf).toContain("SHA256SUMS");
    expect(wf).toContain("gh release view");
    expect(wf).toContain("already exists");
  });

  it("attests only on a public repository", () => {
    expect(wf).toContain("if: ${{ !github.event.repository.private }}");
  });

  it("publishes to npm only when NPM_PUBLISH_ENABLED is 'true', with provenance", () => {
    expect(wf).toContain("if: ${{ vars.NPM_PUBLISH_ENABLED == 'true' }}");
    expect(wf).toContain("--provenance");
    expect(wf).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/);
    const job = wf.slice(wf.indexOf("\n  npm-publish:\n"));
    expect(job).toContain("id-token: write");
    expect(job).toContain("npm must support trusted publishing (11.5.1 or newer)");
  });
});

describe("npm publish arguments", () => {
  // npm reads a bare "dir/file.tgz" as a GitHub "owner/repo" shorthand, so a
  // local tarball must start with "./", "../" or "/".
  const dir = new URL("../../.github/workflows/", import.meta.url);
  const workflows = existsSync(dir) ? readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)) : [];

  /** Arguments of every `npm publish` command line in a workflow. */
  function publishArgs(text: string): string[][] {
    return text
      .split("\n")
      .map((line) => /\bnpm publish\b(.*)$/.exec(line)?.[1])
      .filter((rest): rest is string => rest !== undefined)
      .map((rest) => rest.trim().split(/\s+/).filter(Boolean));
  }

  function badPaths(args: string[]): string[] {
    return args
      .map((a) => a.replace(/^["']|["']$/g, ""))
      .filter((a) => !a.startsWith("-"))
      .filter((a) => a.includes("/") || /\.tgz$/.test(a))
      .filter((a) => !/^(\.\.?\/|\/)/.test(a));
  }

  it("the release workflow publishes a tarball", () => {
    const wf = read(".github/workflows/release.yml");
    const calls = publishArgs(wf);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((args) => args.some((a) => /\.tgz$/.test(a)))).toBe(true);
  });

  it.each(workflows)("%s passes local paths with a leading ./", (file) => {
    for (const args of publishArgs(read(`.github/workflows/${file}`))) {
      expect(badPaths(args), args.join(" ")).toEqual([]);
    }
  });

  it("the check catches a bare relative tarball path", () => {
    expect(badPaths(["release/x-*.tgz", "--provenance"])).toEqual(["release/x-*.tgz"]);
    expect(badPaths(["./release/x-*.tgz", "--tag", '"$tag"'])).toEqual([]);
  });
});
