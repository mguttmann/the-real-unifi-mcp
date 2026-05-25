import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchEndpointSpec } from "../client/rsc.js";
import { CATALOG, type CatalogEntry } from "./catalog.js";
import { emitToolFile } from "./emit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../tools/generated");

async function run(): Promise<void> {
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const successes: string[] = [];
  const failures: { entry: CatalogEntry; reason: string }[] = [];
  const indexImports: string[] = [];

  for (const entry of CATALOG) {
    try {
      const ep = await fetchEndpointSpec(entry.docPath);
      if (!ep) throw new Error("no endpoint block found in RSC");
      if (!ep.method || !ep.path) throw new Error("endpoint missing method/path");
      const filename = `${entry.toolName}.ts`;
      const filePath = resolve(OUT_DIR, filename);
      const source = emitToolFile({
        toolName: entry.toolName,
        surface: entry.surface,
        docPath: entry.docPath,
        endpoint: ep,
      });
      writeFileSync(filePath, source, "utf8");
      indexImports.push(`import { register as register_${entry.toolName} } from "./${entry.toolName}.js";`);
      successes.push(entry.toolName);
    } catch (err) {
      failures.push({ entry, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  const indexSource = `// AUTO-GENERATED. Do not edit by hand.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
${indexImports.join("\n")}

export function registerGeneratedTools(server: McpServer, ctx: ServerContext): void {
${successes.map((n) => `  register_${n}(server, ctx);`).join("\n")}
}
`;
  writeFileSync(resolve(OUT_DIR, "index.ts"), indexSource, "utf8");

  process.stderr.write(`Codegen complete: ${successes.length} ok, ${failures.length} failed\n`);
  for (const f of failures) {
    process.stderr.write(`  FAIL ${f.entry.toolName} (${f.entry.docPath}): ${f.reason}\n`);
  }
  if (failures.length > 0) process.exitCode = 1;
}

run().catch((err) => {
  process.stderr.write(`codegen failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
