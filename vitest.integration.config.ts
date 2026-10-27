import { defineConfig } from "vitest/config";

// The live read-only smoke against api.ui.com (audit N-46). Not part of
// `npm test`; runs with `npm run test:integration` and only when UNIFI_LIVE=1
// and UNIFI_API_KEY are set (the tests skip otherwise).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    restoreMocks: true,
  },
});
