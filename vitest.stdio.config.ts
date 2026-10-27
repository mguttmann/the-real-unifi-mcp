import { defineConfig } from "vitest/config";

// Tests that start the built server (dist/index.js) over stdio. Run after
// `npm run build` with `npm run test:stdio`; the default run excludes them.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/stdio/**/*.test.ts"],
    restoreMocks: true,
  },
});
