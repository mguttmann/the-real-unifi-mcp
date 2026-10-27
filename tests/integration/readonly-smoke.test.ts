/**
 * Live read-only smoke against api.ui.com (audit N-46).
 *
 * Opt-in only: runs with `npm run test:integration` when UNIFI_LIVE=1 and
 * UNIFI_API_KEY are set, and skips otherwise. `npm test` never runs it
 * (vitest.config.ts excludes tests/integration). Every call is a GET; the
 * assertions check response shapes, not the size of one specific network.
 */
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createLogger } from "../../src/utils/logger.js";
import { UnifiClient } from "../../src/client/unifiClient.js";
import { Discovery } from "../../src/client/discovery.js";

const RUN = process.env.UNIFI_LIVE === "1" && !!process.env.UNIFI_API_KEY;

type Page = { data?: unknown[]; totalCount?: number };

function expectPage(page: Page): void {
  expect(Array.isArray(page.data)).toBe(true);
  if (page.totalCount !== undefined) {
    expect(Number.isInteger(page.totalCount)).toBe(true);
    expect(page.totalCount).toBeGreaterThanOrEqual(page.data?.length ?? 0);
  }
}

describe.skipIf(!RUN)(
  "live read-only smoke",
  () => {
    const cfg = RUN ? loadConfig() : null;
    const logger = createLogger("error");
    const client = cfg ? new UnifiClient(cfg, logger) : null;
    const discovery = cfg && client ? new Discovery(client, cfg) : null;

    it("Site Manager: lists hosts", async () => {
      const res = await client!.request<Page>("GET", "/v1/hosts");
      expectPage(res.data);
    });

    it("Network: lists devices as a page", async () => {
      const cid = await discovery!.consoleId();
      const sid = await discovery!.networkSiteId();
      const res = await client!.requestNetwork<Page>("GET", cid, `/v1/sites/${sid}/devices`, {
        query: { limit: 200 },
      });
      expectPage(res.data);
    });

    it("Network: lists firewall policies as a page", async () => {
      const cid = await discovery!.consoleId();
      const sid = await discovery!.networkSiteId();
      const res = await client!.requestNetwork<Page>(
        "GET",
        cid,
        `/v1/sites/${sid}/firewall/policies`,
        { query: { limit: 200 } },
      );
      expectPage(res.data);
    });

    it("Network: identity resolves all three IDs", async () => {
      const id = await discovery!.identity();
      expect(typeof id.consoleId).toBe("string");
      expect(typeof id.networkSiteId).toBe("string");
      expect(typeof id.siteManagerSiteId).toBe("string");
    });
  },
  30_000,
);
