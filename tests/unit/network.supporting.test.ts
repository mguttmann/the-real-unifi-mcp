import { describe, expect, it, vi } from "vitest";
import { registerSupportingTools } from "../../src/tools/network/supporting.js";

describe("network supporting tools", () => {
  it("registers all 8 supporting tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<
      typeof registerSupportingTools
    >[0];
    const ctx = {
      cfg: { confirmWrites: false },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn(), requestNetwork: vi.fn() },
      discovery: { consoleId: vi.fn(), networkSiteId: vi.fn() },
    };
    registerSupportingTools(
      server,
      ctx as unknown as Parameters<typeof registerSupportingTools>[1],
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_wans",
        "unifi_net_list_site_to_site_vpn",
        "unifi_net_list_vpn_servers",
        "unifi_net_list_radius_profiles",
        "unifi_net_list_device_tags",
        "unifi_net_list_dpi_application_categories",
        "unifi_net_list_dpi_applications",
        "unifi_net_list_countries",
      ]),
    );
    expect(names).toHaveLength(8);
  });
});
