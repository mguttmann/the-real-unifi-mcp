import { describe, expect, it, vi } from "vitest";
import { registerNetworkTools } from "../../src/tools/network/networks.js";

describe("network networks tools", () => {
  it("registers all 6 network CRUD tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<
      typeof registerNetworkTools
    >[0];
    const ctx = {
      cfg: { confirmWrites: false },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn(), requestNetwork: vi.fn() },
      discovery: { consoleId: vi.fn(), networkSiteId: vi.fn() },
    };
    registerNetworkTools(server, ctx as unknown as Parameters<typeof registerNetworkTools>[1]);
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_networks",
        "unifi_net_get_network",
        "unifi_net_get_network_references",
        "unifi_net_create_network",
        "unifi_net_update_network",
        "unifi_net_delete_network",
      ]),
    );
  });
});
