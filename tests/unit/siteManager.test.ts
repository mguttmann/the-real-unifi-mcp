import { describe, expect, it, vi } from "vitest";
import { registerSiteManagerTools } from "../../src/tools/siteManager.js";
import type { ServerContext } from "../../src/server.js";

describe("siteManager tools", () => {
  it("registers all 10 expected tool names", () => {
    const tools: string[] = [];
    const server = { registerTool: (name: string) => { tools.push(name); } } as unknown as Parameters<typeof registerSiteManagerTools>[0];
    const ctx = {
      cfg: { confirmWrites: false } as ServerContext["cfg"],
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn() } as unknown as ServerContext["client"],
      discovery: {} as ServerContext["discovery"],
    } as ServerContext;
    registerSiteManagerTools(server, ctx);
    expect(tools).toEqual(
      expect.arrayContaining([
        "unifi_sm_list_hosts",
        "unifi_sm_get_host",
        "unifi_sm_list_sites",
        "unifi_sm_list_devices",
        "unifi_sm_get_isp_metrics",
        "unifi_sm_query_isp_metrics",
        "unifi_sm_list_sdwan_configs",
        "unifi_sm_get_sdwan_config",
        "unifi_sm_get_sdwan_config_status",
        "unifi_sm_identity",
      ]),
    );
  });
});
