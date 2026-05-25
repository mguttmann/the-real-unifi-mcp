import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createLogger } from "../../src/utils/logger.js";
import { UnifiClient } from "../../src/client/unifiClient.js";
import { Discovery } from "../../src/client/discovery.js";

const RUN = !!process.env.UNIFI_API_KEY;

describe.skipIf(!RUN)("live read-only smoke", () => {
  const cfg = RUN ? loadConfig() : null;
  const logger = createLogger("error");
  const client = cfg ? new UnifiClient(cfg, logger) : null;
  const discovery = cfg && client ? new Discovery(client, cfg) : null;

  it("Site Manager: lists hosts", async () => {
    const res = await client!.request<{ data: unknown[] }>("GET", "/v1/hosts");
    const data = (res.data as { data?: unknown[] })?.data ?? (res.data as unknown[]);
    expect(Array.isArray(data)).toBe(true);
  });

  it("Network: lists devices (~16 expected)", async () => {
    const cid = await discovery!.consoleId();
    const sid = await discovery!.networkSiteId();
    const res = await client!.requestNetwork<{ data: unknown[]; totalCount?: number }>("GET", cid, `/v1/sites/${sid}/devices`, { query: { limit: 200 } });
    const tc = (res.data as { totalCount?: number }).totalCount;
    expect(tc ?? (res.data as { data?: unknown[] }).data?.length).toBeGreaterThanOrEqual(10);
  });

  it("Network: lists firewall policies (~65 expected)", async () => {
    const cid = await discovery!.consoleId();
    const sid = await discovery!.networkSiteId();
    const res = await client!.requestNetwork<{ totalCount?: number; data?: unknown[] }>("GET", cid, `/v1/sites/${sid}/firewall/policies`, { query: { limit: 200 } });
    const tc = res.data.totalCount ?? res.data.data?.length;
    expect(tc).toBeGreaterThanOrEqual(20);
  });

  it("Network: identity resolves all three IDs", async () => {
    const id = await discovery!.identity();
    expect(id.consoleId).toBeTruthy();
    expect(id.networkSiteId).toBeTruthy();
    expect(id.siteManagerSiteId).toBeTruthy();
  });
}, 30_000);
