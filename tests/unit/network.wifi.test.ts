import { describe, expect, it, vi } from "vitest";
import { registerWifiTools } from "../../src/tools/network/wifi.js";

describe("network wifi tools", () => {
  it("registers all 5 wifi CRUD tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<
      typeof registerWifiTools
    >[0];
    const ctx = {
      cfg: { confirmWrites: false },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn(), requestNetwork: vi.fn() },
      discovery: { consoleId: vi.fn(), networkSiteId: vi.fn() },
    };
    registerWifiTools(server, ctx as unknown as Parameters<typeof registerWifiTools>[1]);
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_wifi",
        "unifi_net_get_wifi",
        "unifi_net_create_wifi",
        "unifi_net_update_wifi",
        "unifi_net_delete_wifi",
      ]),
    );
  });
});
