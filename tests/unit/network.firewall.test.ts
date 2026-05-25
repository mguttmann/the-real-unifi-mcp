import { describe, expect, it, vi } from "vitest";
import { registerFirewallTools } from "../../src/tools/network/firewall.js";

describe("network firewall tools", () => {
  it("registers all 13 firewall tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<typeof registerFirewallTools>[0];
    const ctx = {
      cfg: { confirmWrites: false },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn(), requestNetwork: vi.fn() },
      discovery: { consoleId: vi.fn(), networkSiteId: vi.fn() },
    };
    registerFirewallTools(server, ctx as unknown as Parameters<typeof registerFirewallTools>[1]);
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_firewall_zones",
        "unifi_net_get_firewall_zone",
        "unifi_net_create_firewall_zone",
        "unifi_net_update_firewall_zone",
        "unifi_net_delete_firewall_zone",
        "unifi_net_list_firewall_policies",
        "unifi_net_get_firewall_policy",
        "unifi_net_create_firewall_policy",
        "unifi_net_update_firewall_policy",
        "unifi_net_patch_firewall_policy",
        "unifi_net_delete_firewall_policy",
        "unifi_net_get_firewall_policy_ordering",
        "unifi_net_reorder_firewall_policies",
      ]),
    );
    expect(names).toHaveLength(13);
  });
});
