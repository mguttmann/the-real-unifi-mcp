/**
 * Audit N-46: `npm test` must stay offline. The live smoke in
 * `tests/integration/` is excluded from the default vitest run, runs only
 * through `npm run test:integration` with `UNIFI_LIVE=1` and a key, and
 * asserts response shapes, not counts of one specific network.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import defaultConfig from "../../vitest.config.js";
import integrationConfig from "../../vitest.integration.config.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, "utf8")) as {
  scripts: Record<string, string>;
};
const smoke = readFileSync(`${ROOT}tests/integration/readonly-smoke.test.ts`, "utf8");

describe("live smoke is opt-in (N-46)", () => {
  it("the default vitest run (npm test) excludes tests/integration", () => {
    expect(defaultConfig.test?.exclude).toContain("tests/integration/**");
  });

  it("npm run test:integration uses its own config that includes only tests/integration", () => {
    expect(pkg.scripts["test:integration"]).toBe(
      "vitest run --config vitest.integration.config.ts",
    );
    expect(integrationConfig.test?.include).toEqual(["tests/integration/**/*.test.ts"]);
  });

  it("the smoke runs only with UNIFI_LIVE=1 and a key", () => {
    expect(smoke).toMatch(/process\.env\.UNIFI_LIVE === "1" && !!process\.env\.UNIFI_API_KEY/);
  });

  it("the smoke asserts shapes, not counts of one network", () => {
    expect(smoke).not.toMatch(/toBeGreaterThanOrEqual\(\s*[1-9]/);
    expect(smoke).not.toMatch(/expected\)/);
  });
});
