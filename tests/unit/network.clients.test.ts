import { describe, expect, it, vi } from "vitest";
import { registerClientTools } from "../../src/tools/network/clients.js";

describe("network client tools", () => {
  it("registers all 5 client tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<typeof registerClientTools>[0];
    const ctx = {
      cfg: { confirmWrites: false },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn(), requestNetwork: vi.fn() },
      discovery: { consoleId: vi.fn(), networkSiteId: vi.fn() },
    };
    registerClientTools(server, ctx as unknown as Parameters<typeof registerClientTools>[1]);
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_clients",
        "unifi_net_get_client",
        "unifi_net_client_action",
        "unifi_net_block_client",
        "unifi_net_unblock_client",
      ]),
    );
  });
});
