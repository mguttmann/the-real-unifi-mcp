import { describe, expect, it, vi } from "vitest";
import { registerAclTools } from "../../src/tools/network/acl.js";

describe("network ACL tools", () => {
  it("registers all 7 ACL tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<
      typeof registerAclTools
    >[0];
    const ctx = {
      cfg: { confirmWrites: false },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn(), requestNetwork: vi.fn() },
      discovery: { consoleId: vi.fn(), networkSiteId: vi.fn() },
    };
    registerAclTools(server, ctx as unknown as Parameters<typeof registerAclTools>[1]);
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_acl_rules",
        "unifi_net_get_acl_rule",
        "unifi_net_create_acl_rule",
        "unifi_net_update_acl_rule",
        "unifi_net_delete_acl_rule",
        "unifi_net_get_acl_rule_ordering",
        "unifi_net_reorder_acl_rules",
      ]),
    );
    expect(names).toHaveLength(7);
  });
});
