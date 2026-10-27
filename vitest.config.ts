import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // tests/stdio needs dist/ and runs through `npm run test:stdio` after the build.
    exclude: ["**/node_modules/**", "tests/stdio/**"],
    coverage: { reporter: ["text", "html"], reportsDirectory: "coverage" },
    restoreMocks: true,
  },
});
