/**
 * Supported Node floor (audit N-15): one value in package.json engines, the
 * lockfile root, the MCPB manifest and the README; .nvmrc and CI stay on or
 * above it.
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

/** ">=22.12" / ">=22.12.0" -> [22, 12, 0]. */
function floor(range: string | undefined): [number, number, number] {
  const m = /^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(range ?? "");
  if (!m) throw new Error(`not a plain >= range: ${String(range)}`);
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

describe("Node floor", () => {
  const expected = floor(pkg.engines.node);

  it("package.json engines is >=22.12", () => {
    expect(pkg.engines.node).toBe(">=22.12");
  });

  it("lockfile root and MCPB manifest state the same floor", () => {
    expect(floor(lock.packages[""]?.engines?.node)).toEqual(expected);
    expect(floor(manifest.compatibility?.runtimes?.node)).toEqual(expected);
  });

  it("README states the floor", () => {
    const readme = read("README.md");
    expect(readme).toContain(`Node.js >= ${expected[0]}.${expected[1]}`);
    expect(readme).toContain(`node-%3E%3D${expected[0]}.${expected[1]}`);
  });

  it(".nvmrc is at or above the floor", () => {
    expect(Number(read(".nvmrc").trim())).toBeGreaterThanOrEqual(expected[0]);
  });

  it("CI runs a job on the exact floor version", () => {
    expect(read(".github/workflows/ci.yml")).toContain(`"${expected.join(".")}"`);
  });
});
