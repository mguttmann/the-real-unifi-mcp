/**
 * Audit N-16, N-61: tests, scripts and config files are type-checked and
 * linted with type information, not only src/. CI runs the same npm scripts.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
const testsTsconfig = JSON.parse(read("tsconfig.tests.json")) as {
  compilerOptions: { noEmit?: boolean; checkJs?: boolean };
  include: string[];
};

describe("type-checked and linted scope (N-16, N-61)", () => {
  it("npm run typecheck checks src/ and the tests tsconfig", () => {
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit && tsc -p tsconfig.tests.json");
  });

  it("tsconfig.tests.json covers tests, scripts and the shared contract helper", () => {
    expect(testsTsconfig.compilerOptions.noEmit).toBe(true);
    expect(testsTsconfig.compilerOptions.checkJs).toBe(true);
    expect(testsTsconfig.include).toEqual(
      expect.arrayContaining(["src/**/*", "tests/**/*", "scripts/**/*.mjs"]),
    );
  });

  it("npm run lint lints the whole repository with type information", () => {
    expect(pkg.scripts.lint).toBe("eslint .");
    const config = read("eslint.config.js");
    expect(config).toContain("tseslint.configs.recommendedTypeChecked");
    expect(config).toContain('project: "./tsconfig.tests.json"');
  });

  it("CI runs both scripts", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("- run: npm run lint");
    expect(ci).toContain("- run: npm run typecheck");
  });
});
