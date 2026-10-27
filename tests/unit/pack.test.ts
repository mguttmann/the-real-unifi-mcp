/**
 * npm package contents (audit N-77): `npm pack --dry-run --json` lists exactly
 * README.md, LICENSE, NOTICE, SECURITY.md, package.json and the compiled
 * runtime (`dist/**\/*.js` without the code generator and `dist/client/rsc.js`):
 * no sources, source maps, type declarations, tests or vendor fixtures.
 *
 * Runs in prebuild, before `tsc`: when dist/ is missing (a fresh clone), the
 * dist part of the list is empty and only the fixed files are compared.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("npm pack file list (N-77)", () => {
  it("ships the fixed files and the compiled runtime only", () => {
    const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, npm_config_loglevel: "silent" },
    });
    const [pack] = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
    const packed = pack!.files.map((f) => f.path).sort();

    const runtime = walk(join(ROOT, "dist"))
      .map((f) => relative(ROOT, f).split("\\").join("/"))
      .filter((p) => p.endsWith(".js"))
      .filter((p) => !p.startsWith("dist/codegen/") && p !== "dist/client/rsc.js");
    const expected = [
      "LICENSE",
      "NOTICE",
      "README.md",
      "SECURITY.md",
      "package.json",
      ...runtime,
    ].sort();
    expect(packed).toEqual(expected);
    if (runtime.length > 0) expect(packed).toContain("dist/index.js");
    expect(packed.filter((p) => /\.(map|ts)$/.test(p))).toEqual([]);
  }, 30_000);
});
