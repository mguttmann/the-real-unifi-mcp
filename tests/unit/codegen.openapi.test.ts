/**
 * Code generator against the committed vendor OpenAPI documents
 * (N-36, N-37, N-38, N-44). Offline: the documents in tests/fixtures/openapi/
 * are the ones `npm run codegen` downloaded from developer.ui.com.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CATALOG,
  EXCLUDED_OPERATIONS,
  SPEC_VERSIONS,
  specFixtureName,
  specUrl,
} from "../../src/codegen/catalog.js";
import { findOperation, listOperations, type OpenApiDoc } from "../../src/codegen/openapi.js";
import { generateFiles, loadFixtureSpecs, runCodegen } from "../../src/codegen/generate.js";

const FIXTURE_DIR = fileURLToPath(new URL("../fixtures/openapi/", import.meta.url));

const tempDirs: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "codegen-test-"));
  tempDirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe("catalog against the vendor OpenAPI documents", () => {
  const specs = loadFixtureSpecs(FIXTURE_DIR);

  it("pins Network v11.0.97 and Site Manager v1.0.0 (N-38)", () => {
    expect(SPEC_VERSIONS).toEqual({ siteManager: "v1.0.0", network: "v11.0.97" });
    expect(specUrl("network", "v11.0.97")).toBe(
      "https://developer.ui.com/network/v11.0.97/openapi.json",
    );
    expect(specFixtureName("siteManager", "v1.0.0")).toBe("site-manager_v1.0.0.json");
  });

  it("every catalog entry resolves to one vendor operation (N-36)", () => {
    const missing = CATALOG.filter((e) => {
      const doc = specs.get(`${e.surface}@${e.specVersion}`);
      return !doc || !findOperation(doc, e.slug);
    }).map((e) => e.toolName);
    expect(missing).toEqual([]);
    const names = CATALOG.map((e) => e.toolName);
    expect(names).toContain("unifi_gen_gethostbyid");
    expect(names).toContain("unifi_gen_getsdwanconfigbyid");
    expect(names).not.toContain("unifi_gen_gethost");
    expect(new Set(names).size).toBe(names.length);
  });

  it("every vendor operation is either catalogued or explicitly excluded", () => {
    const catalogued = new Set(CATALOG.map((e) => `${e.surface}:${e.slug}`));
    const stray: string[] = [];
    for (const surface of ["siteManager", "network"] as const) {
      const doc = specs.get(`${surface}@${SPEC_VERSIONS[surface]}`) as OpenApiDoc;
      for (const op of listOperations(doc)) {
        const slug = String(op.operationId).toLowerCase();
        if (!catalogued.has(`${surface}:${slug}`) && !EXCLUDED_OPERATIONS[surface].includes(slug))
          stray.push(`${surface}:${slug}`);
      }
    }
    expect(stray).toEqual([]);
    expect(EXCLUDED_OPERATIONS.siteManager).toEqual([
      "connectordelete",
      "connectorget",
      "connectorpatch",
      "connectorpost",
      "connectorput",
    ]);
  });

  it("reads the request body from content application/json and its required flag (N-37)", () => {
    const doc = specs.get(`network@${SPEC_VERSIONS.network}`) as OpenApiDoc;
    const op = findOperation(doc, "createfirewallzone");
    expect(op?.method).toBe("POST");
    expect(op?.path).toBe("/v1/sites/{siteId}/firewall/zones");
    expect(op?.requestBody?.required).toBe(true);
    expect(op?.requestBody?.schema).toEqual({
      $ref: "#/components/schemas/Create or update firewall zone",
    });
  });
});

/** A minimal vendor document with one GET and one POST operation. */
function miniSpec(extra: Record<string, unknown> = {}): OpenApiDoc {
  return {
    paths: {
      "/v1/hosts": { get: { operationId: "listHosts", summary: "List Hosts" } },
      ...extra,
    },
  } as OpenApiDoc;
}

describe("runCodegen swaps the output only on full success (N-44)", () => {
  function seedOutDir(): string {
    const out = join(tempDir(), "generated");
    mkdirSync(out);
    writeFileSync(join(out, "unifi_gen_old.ts"), "// old\n");
    return out;
  }

  it("leaves the old files in place and reports when an operation is missing", async () => {
    const out = seedOutDir();
    const fixtures = tempDir();
    writeFileSync(join(fixtures, "site-manager_v1.0.0.json"), JSON.stringify(miniSpec()));
    writeFileSync(join(fixtures, "network_v11.0.97.json"), JSON.stringify(miniSpec()));
    const res = await runCodegen({ offline: true, outDir: out, fixtureDir: fixtures });
    expect(res.ok).toBe(false);
    expect(res.failures.length).toBeGreaterThan(0);
    expect(res.failures.join("\n")).toMatch(/unifi_gen_getinfo/);
    expect(readdirSync(out)).toEqual(["unifi_gen_old.ts"]);
    expect(readdirSync(join(out, ".."))).toEqual(["generated"]);
  });

  it("does not write fetched specs when generation fails, and fails on a bad HTTP status", async () => {
    const out = seedOutDir();
    const fixtures = tempDir();
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("network")
        ? new Response("not found", { status: 404 })
        : new Response(JSON.stringify(miniSpec()), { status: 200 }),
    );
    const res = await runCodegen({
      offline: false,
      outDir: out,
      fixtureDir: fixtures,
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(res.ok).toBe(false);
    expect(res.failures.join("\n")).toMatch(/HTTP 404/);
    expect(readdirSync(fixtures)).toEqual([]);
    expect(readdirSync(out)).toEqual(["unifi_gen_old.ts"]);
  });

  it("replaces the output and writes the fetched specs on success", async () => {
    const out = seedOutDir();
    const fixtures = tempDir();
    const bodies = new Map<string, string>();
    for (const f of readdirSync(FIXTURE_DIR))
      bodies.set(f, readFileSync(join(FIXTURE_DIR, f), "utf8"));
    const fetchMock = vi.fn(async (url: string) => {
      const [, dir, version] = /developer\.ui\.com\/([^/]+)\/([^/]+)\/openapi\.json$/.exec(url)!;
      const body = bodies.get(`${dir}_${version}.json`);
      return body ? new Response(body, { status: 200 }) : new Response("", { status: 404 });
    });
    const res = await runCodegen({
      offline: false,
      outDir: out,
      fixtureDir: fixtures,
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(res.failures).toEqual([]);
    expect(res.ok).toBe(true);
    expect(existsSync(join(out, "unifi_gen_old.ts"))).toBe(false);
    expect(existsSync(join(out, "index.ts"))).toBe(true);
    expect(readdirSync(out)).toHaveLength(CATALOG.length + 1);
    expect(readdirSync(join(out, ".."))).toEqual(["generated"]);
    for (const f of readdirSync(fixtures))
      expect(readFileSync(join(fixtures, f), "utf8")).toBe(bodies.get(f));
    expect(readdirSync(fixtures).sort()).toEqual([...bodies.keys()].sort());
  });
});

describe("generateFiles", () => {
  it("fails loudly on a vendor operation that is neither catalogued nor excluded", () => {
    const specs = loadFixtureSpecs(FIXTURE_DIR);
    const key = `network@${SPEC_VERSIONS.network}`;
    const doc = structuredClone(specs.get(key)) as OpenApiDoc;
    doc.paths["/v1/brand-new"] = { get: { operationId: "getBrandNew", summary: "New" } };
    specs.set(key, doc);
    const { failures } = generateFiles(specs);
    expect(failures).toEqual([expect.stringMatching(/new vendor operation network:getbrandnew/i)]);
  });
});
