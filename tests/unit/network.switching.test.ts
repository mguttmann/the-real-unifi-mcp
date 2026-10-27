import { describe, expect, it, vi } from "vitest";
import { registerSwitchingTools } from "../../src/tools/network/switching.js";

describe("network switching tools", () => {
  it("registers all 6 switching tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<
      typeof registerSwitchingTools
    >[0];
    const ctx = {
      cfg: { confirmWrites: false },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn(), requestNetwork: vi.fn() },
      discovery: { consoleId: vi.fn(), networkSiteId: vi.fn() },
    };
    registerSwitchingTools(server, ctx as unknown as Parameters<typeof registerSwitchingTools>[1]);
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_switch_stacks",
        "unifi_net_get_switch_stack",
        "unifi_net_list_mclag_domains",
        "unifi_net_get_mclag_domain",
        "unifi_net_list_lags",
        "unifi_net_get_lag",
      ]),
    );
    expect(names).toHaveLength(6);
  });
});
