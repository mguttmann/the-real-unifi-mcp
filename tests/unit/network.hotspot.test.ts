import { describe, expect, it, vi } from "vitest";
import { registerHotspotTools } from "../../src/tools/network/hotspot.js";

describe("network hotspot voucher tools", () => {
  it("registers all 5 hotspot voucher tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<
      typeof registerHotspotTools
    >[0];
    const ctx = {
      cfg: { confirmWrites: false },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn(), requestNetwork: vi.fn() },
      discovery: { consoleId: vi.fn(), networkSiteId: vi.fn() },
    };
    registerHotspotTools(server, ctx as unknown as Parameters<typeof registerHotspotTools>[1]);
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_vouchers",
        "unifi_net_get_voucher",
        "unifi_net_create_vouchers",
        "unifi_net_delete_voucher",
        "unifi_net_delete_vouchers",
      ]),
    );
    expect(names).toHaveLength(5);
  });
});
