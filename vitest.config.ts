import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // tests/stdio needs dist/ and runs through `npm run test:stdio` after the build.
    // tests/integration calls api.ui.com and runs only through
    // `npm run test:integration` with UNIFI_LIVE=1 (audit N-46).
    exclude: ["**/node_modules/**", "tests/stdio/**", "tests/integration/**"],
    coverage: { reporter: ["text", "html"], reportsDirectory: "coverage" },
    restoreMocks: true,
  },
});
