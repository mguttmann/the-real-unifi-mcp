/**
 * Supported Node lines (audit N-15, 0.3.0 review): one range in package.json
 * engines, the lockfile root, the MCPB manifest and the README. It is the
 * range of the test toolchain (vitest), because `prebuild` runs the unit tests
 * in every source build of a consumer; Node 23 and 25 are outside it. .nvmrc
 * and CI stay inside it, and CI runs the exact floor version.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json")) as { engines: { node: string } };
const lock = JSON.parse(read("package-lock.json")) as {
  packages: Record<string, { engines?: { node?: string } }>;
};
const manifest = JSON.parse(read("mcpb/manifest.json")) as {
  compatibility?: { runtimes?: { node?: string } };
};

const RANGE = "^22.12.0 || ^24.0.0 || >=26.0.0";

/** Majors the range admits up to `max`: "^22.12.0 || ^24.0.0 || >=26.0.0" -> 22, 24, 26, ... */
function majors(range: string, max: number): number[] {
  const out = new Set<number>();
  for (const part of range.split("||").map((p) => p.trim())) {
    const caret = /^\^(\d+)\.\d+\.\d+$/.exec(part);
    const atLeast = /^>=(\d+)\.\d+\.\d+$/.exec(part);
    if (caret) out.add(Number(caret[1]));
    else if (atLeast) for (let m = Number(atLeast[1]); m <= max; m++) out.add(m);
    else throw new Error(`unexpected range part: ${part}`);
  }
  return [...out].sort((a, b) => a - b);
}

describe("supported Node lines", () => {
  it(`package.json engines is ${RANGE}`, () => {
    expect(pkg.engines.node).toBe(RANGE);
  });

  it("equals the engines range of vitest, which prebuild runs", () => {
    expect(lock.packages["node_modules/vitest"]?.engines?.node).toBe(RANGE);
  });

  it("excludes Node 23 and 25", () => {
    expect(majors(RANGE, 27)).toEqual([22, 24, 26, 27]);
  });

  it("lockfile root and MCPB manifest state the same range", () => {
    expect(lock.packages[""]?.engines?.node).toBe(RANGE);
    expect(manifest.compatibility?.runtimes?.node).toBe(RANGE);
  });

  it("README states the range", () => {
    const readme = read("README.md");
    expect(readme).toContain(`\`engines\`: \`${RANGE}\``);
    expect(readme).toContain("node-22.12%2B%20%7C%2024%20%7C%2026%2B");
  });

  it(".nvmrc is a supported major", () => {
    expect(majors(RANGE, 40)).toContain(Number(read(".nvmrc").trim()));
  });

  it("CI runs a job on the exact floor version and only on supported majors", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain('"22.12.0"');
    const matrix = /node: \[([^\]]*)\]/.exec(ci)?.[1] ?? "";
    const lines = [...matrix.matchAll(/"(\d+)(?:\.\d+\.\d+)?"/g)].map((m) => Number(m[1]));
    expect(lines.length).toBeGreaterThan(0);
    for (const m of lines) expect(majors(RANGE, 40)).toContain(m);
  });
});
