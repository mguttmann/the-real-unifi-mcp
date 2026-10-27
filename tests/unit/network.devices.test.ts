import { describe, expect, it, vi } from "vitest";
import { registerDeviceTools } from "../../src/tools/network/devices.js";

function mkCtx() {
  const requestNetwork = vi
    .fn()
    .mockResolvedValue({ data: { data: [], totalCount: 0 }, status: 200, headers: new Headers() });
  const ctx = {
    cfg: { confirmWrites: false },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    client: { request: vi.fn(), requestNetwork },
    discovery: {
      consoleId: vi.fn().mockResolvedValue("C1"),
      networkSiteId: vi.fn().mockResolvedValue("S1"),
    },
  };
  return { ctx, requestNetwork };
}

describe("network device tools", () => {
  it("registers all 9 device tools", () => {
    const { ctx } = mkCtx();
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<
      typeof registerDeviceTools
    >[0];
    registerDeviceTools(server, ctx as unknown as Parameters<typeof registerDeviceTools>[1]);
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_devices",
        "unifi_net_get_device",
        "unifi_net_get_device_stats",
        "unifi_net_list_pending_devices",
        "unifi_net_adopt_devices",
        "unifi_net_device_action",
        "unifi_net_reboot_device",
        "unifi_net_port_action",
        "unifi_net_remove_device",
      ]),
    );
  });

  it("reboot_device sends the vendor value action=RESTART (M-6)", async () => {
    const { ctx, requestNetwork } = mkCtx();
    let handler!: (a: { deviceId: string }) => Promise<unknown>;
    const server = {
      registerTool: (n: string, _def: unknown, h: typeof handler) => {
        if (n === "unifi_net_reboot_device") handler = h;
      },
    } as unknown as Parameters<typeof registerDeviceTools>[0];
    registerDeviceTools(server, ctx as unknown as Parameters<typeof registerDeviceTools>[1]);
    await handler({ deviceId: "D1" });
    expect(requestNetwork).toHaveBeenCalledWith(
      "POST",
      "C1",
      "/v1/sites/S1/devices/D1/actions",
      expect.objectContaining({ body: { action: "RESTART" } }),
    );
  });
});
