import { describe, expect, it, vi } from "vitest";
import { registerTrafficListTools } from "../../src/tools/network/trafficLists.js";

describe("network traffic matching list tools", () => {
  it("registers all 5 traffic matching list tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<
      typeof registerTrafficListTools
    >[0];
    const ctx = {
      cfg: { confirmWrites: false },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn(), requestNetwork: vi.fn() },
      discovery: { consoleId: vi.fn(), networkSiteId: vi.fn() },
    };
    registerTrafficListTools(
      server,
      ctx as unknown as Parameters<typeof registerTrafficListTools>[1],
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_traffic_lists",
        "unifi_net_get_traffic_list",
        "unifi_net_create_traffic_list",
        "unifi_net_update_traffic_list",
        "unifi_net_delete_traffic_list",
      ]),
    );
    expect(names).toHaveLength(5);
  });
});
