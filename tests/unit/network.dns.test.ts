import { describe, expect, it, vi } from "vitest";
import { registerDnsTools } from "../../src/tools/network/dns.js";

describe("network DNS policy tools", () => {
  it("registers all 5 DNS policy tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<
      typeof registerDnsTools
    >[0];
    const ctx = {
      cfg: { confirmWrites: false },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn(), requestNetwork: vi.fn() },
      discovery: { consoleId: vi.fn(), networkSiteId: vi.fn() },
    };
    registerDnsTools(server, ctx as unknown as Parameters<typeof registerDnsTools>[1]);
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_dns_policies",
        "unifi_net_get_dns_policy",
        "unifi_net_create_dns_policy",
        "unifi_net_update_dns_policy",
        "unifi_net_delete_dns_policy",
      ]),
    );
    expect(names).toHaveLength(5);
  });
});
