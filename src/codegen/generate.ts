/**
 * Code generator: `npm run codegen` downloads the vendor OpenAPI documents
 * (developer.ui.com, public docs only) into tests/fixtures/openapi/ and
 * regenerates src/tools/generated/; `npm run codegen -- --offline` generates
 * from the committed documents only.
 *
 * N-44: everything is generated in memory first; on any failure (download,
 * missing operation, new uncatalogued vendor operation) nothing is written and
 * the run exits 1. On success the new files are written to a sibling temp
 * directory that then replaces src/tools/generated/.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CATALOG,
  EXCLUDED_OPERATIONS,
  SPEC_VERSIONS,
  specFixtureName,
  specUrl,
  type Surface,
} from "./catalog.js";
import { emitToolFile } from "./emit.js";
import { findOperation, listOperations, type OpenApiDoc } from "./openapi.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../tools/generated");
const FIXTURE_DIR = resolve(__dirname, "../../tests/fixtures/openapi");

/** Vendor documents keyed `${surface}@${version}`. */
export type Specs = Map<string, OpenApiDoc>;

/** Every (surface, version) document the catalog needs. */
function neededSpecs(): Array<{ surface: Surface; version: string }> {
  const seen = new Map<string, { surface: Surface; version: string }>();
  for (const surface of Object.keys(SPEC_VERSIONS) as Surface[])
    seen.set(`${surface}@${SPEC_VERSIONS[surface]}`, { surface, version: SPEC_VERSIONS[surface] });
  for (const e of CATALOG)
    seen.set(`${e.surface}@${e.specVersion}`, { surface: e.surface, version: e.specVersion });
  return [...seen.values()];
}

/** Reads the committed vendor documents the catalog needs (missing files are left out). */
export function loadFixtureSpecs(fixtureDir: string): Specs {
  const specs: Specs = new Map();
  for (const { surface, version } of neededSpecs()) {
    const file = join(fixtureDir, specFixtureName(surface, version));
    if (existsSync(file))
      specs.set(`${surface}@${version}`, JSON.parse(readFileSync(file, "utf8")) as OpenApiDoc);
  }
  return specs;
}

/** Generates all tool files plus index.ts in memory. */
export function generateFiles(specs: Specs): { files: Map<string, string>; failures: string[] } {
  const files = new Map<string, string>();
  const failures: string[] = [];

  // A vendor operation without a catalog entry would silently never become a tool.
  const catalogued = new Set(CATALOG.map((e) => `${e.surface}:${e.slug}`));
  for (const surface of Object.keys(SPEC_VERSIONS) as Surface[]) {
    const doc = specs.get(`${surface}@${SPEC_VERSIONS[surface]}`);
    if (!doc) continue; // reported per entry below
    for (const op of listOperations(doc)) {
      const slug = String(op.operationId ?? `${op.method} ${op.path}`).toLowerCase();
      if (!catalogued.has(`${surface}:${slug}`) && !EXCLUDED_OPERATIONS[surface].includes(slug))
        failures.push(
          `new vendor operation ${surface}:${slug} (${op.method} ${op.path}): add it to src/codegen/catalog.ts or to EXCLUDED_OPERATIONS`,
        );
    }
  }

  for (const entry of CATALOG) {
    const doc = specs.get(`${entry.surface}@${entry.specVersion}`);
    if (!doc) {
      failures.push(`${entry.toolName}: no vendor document ${entry.surface} ${entry.specVersion}`);
      continue;
    }
    const ep = findOperation(doc, entry.slug);
    if (!ep) {
      failures.push(
        `${entry.toolName}: operation ${entry.slug} not in ${entry.surface} ${entry.specVersion}; if the vendor removed it, pin it in REMOVED_UPSTREAM (src/codegen/catalog.ts), never drop the tool`,
      );
      continue;
    }
    const input = {
      toolName: entry.toolName,
      surface: entry.surface,
      docPath: entry.docPath,
      endpoint: ep,
      refs: doc.components?.schemas ?? {},
    };
    files.set(
      `${entry.toolName}.ts`,
      emitToolFile(
        entry.removedUpstream ? { ...input, removedUpstream: entry.removedUpstream } : input,
      ),
    );
  }

  const names = CATALOG.map((e) => e.toolName).filter((n) => files.has(`${n}.ts`));
  files.set(
    "index.ts",
    `// AUTO-GENERATED. Do not edit by hand.
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
${names.map((n) => `import { register as register_${n} } from "./${n}.js";`).join("\n")}

export function registerGeneratedTools(server: McpServer, ctx: ServerContext): void {
${names.map((n) => `  register_${n}(server, ctx);`).join("\n")}
}
`,
  );
  return { files, failures };
}

export interface CodegenOptions {
  /** Generate from the committed documents only; no network. */
  offline: boolean;
  outDir?: string;
  fixtureDir?: string;
  fetch?: typeof globalThis.fetch;
}

export interface CodegenResult {
  ok: boolean;
  failures: string[];
  count: number;
}

/** Replaces `outDir` with `files` through a sibling temp directory. */
function swapInto(outDir: string, files: Map<string, string>): void {
  const tmp = `${outDir}.tmp-${process.pid}`;
  const old = `${outDir}.old-${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  try {
    for (const [name, source] of files) writeFileSync(join(tmp, name), source, "utf8");
    if (existsSync(outDir)) renameSync(outDir, old);
    renameSync(tmp, outDir);
  } catch (err) {
    if (!existsSync(outDir) && existsSync(old)) renameSync(old, outDir);
    rmSync(tmp, { recursive: true, force: true });
    throw err;
  }
  rmSync(old, { recursive: true, force: true });
}

export async function runCodegen(opts: CodegenOptions): Promise<CodegenResult> {
  const outDir = opts.outDir ?? OUT_DIR;
  const fixtureDir = opts.fixtureDir ?? FIXTURE_DIR;
  const failures: string[] = [];
  let specs: Specs;
  const downloaded = new Map<string, string>(); // fixture file name -> raw text

  if (opts.offline) {
    specs = loadFixtureSpecs(fixtureDir);
  } else {
    specs = new Map();
    const f = opts.fetch ?? globalThis.fetch;
    for (const { surface, version } of neededSpecs()) {
      const url = specUrl(surface, version);
      try {
        const res = await f(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        specs.set(`${surface}@${version}`, JSON.parse(text) as OpenApiDoc);
        downloaded.set(specFixtureName(surface, version), text);
      } catch (err) {
        failures.push(`download ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (failures.length > 0) return { ok: false, failures, count: 0 };
  const generated = generateFiles(specs);
  if (generated.failures.length > 0) return { ok: false, failures: generated.failures, count: 0 };

  if (downloaded.size > 0) {
    mkdirSync(fixtureDir, { recursive: true });
    for (const [name, text] of downloaded) writeFileSync(join(fixtureDir, name), text, "utf8");
  }
  swapInto(outDir, generated.files);
  return { ok: true, failures: [], count: generated.files.size - 1 };
}

async function main(): Promise<void> {
  const offline = process.argv.includes("--offline");
  const res = await runCodegen({ offline });
  if (res.ok) {
    process.stderr.write(
      `Codegen complete: ${res.count} tools written to src/tools/generated/${offline ? " (offline)" : ""}\n`,
    );
    return;
  }
  process.stderr.write(
    `Codegen failed, src/tools/generated/ left unchanged:\n${res.failures.map((f) => `  FAIL ${f}`).join("\n")}\n`,
  );
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err: unknown) => {
    process.stderr.write(`codegen failed: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
