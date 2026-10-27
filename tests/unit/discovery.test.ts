import { describe, expect, it, vi } from "vitest";
import { Discovery } from "../../src/client/discovery.js";
import type { UnifiClient } from "../../src/client/unifiClient.js";

const ok = <T>(data: T) => ({ data, status: 200, headers: new Headers() });

function clientMock(): {
  client: UnifiClient;
  request: ReturnType<typeof vi.fn>;
  requestNetwork: ReturnType<typeof vi.fn>;
} {
  const request = vi.fn();
  const requestNetwork = vi.fn();
  const client = { request, requestNetwork } as unknown as UnifiClient;
  return { client, request, requestNetwork };
}

describe("Discovery", () => {
  it("resolves consoleId from /v1/hosts (type=console, owner=true)", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(
      ok({
        data: [
          { id: "A", type: "console", owner: false },
          { id: "B", type: "console", owner: true },
        ],
      }),
    );
    const d = new Discovery(client, {});
    expect(await d.consoleId()).toBe("B");
  });

  it("uses override when configured", async () => {
    const { client, request } = clientMock();
    const d = new Discovery(client, { consoleIdOverride: "PINNED" });
    expect(await d.consoleId()).toBe("PINNED");
    expect(request).not.toHaveBeenCalled();
  });

  it("caches consoleId across calls", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValue(ok({ data: [{ id: "X", type: "console", owner: true }] }));
    const d = new Discovery(client, {});
    await d.consoleId();
    await d.consoleId();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("throws on zero matching consoles", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(ok({ data: [] }));
    const d = new Discovery(client, {});
    await expect(d.consoleId()).rejects.toThrow(/no.*console/i);
  });

  it("throws on multiple matching consoles without override", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(
      ok({
        data: [
          { id: "A", type: "console", owner: true },
          { id: "B", type: "console", owner: true },
        ],
      }),
    );
    const d = new Discovery(client, {});
    await expect(d.consoleId()).rejects.toThrow(/multiple.*UNIFI_CONSOLE_ID/i);
  });

  it("resolves networkSiteId via requestNetwork", async () => {
    const { client, request, requestNetwork } = clientMock();
    request.mockResolvedValue(ok({ data: [{ id: "C", type: "console", owner: true }] }));
    requestNetwork.mockResolvedValueOnce(ok({ data: [{ id: "SITE-N", name: "Default" }] }));
    const d = new Discovery(client, {});
    expect(await d.networkSiteId()).toBe("SITE-N");
  });

  it("resolves siteManagerSiteId from /v1/sites", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(ok({ data: [{ siteId: "SM1" }] }));
    const d = new Discovery(client, {});
    expect(await d.siteManagerSiteId()).toBe("SM1");
  });

  it("throws on multiple Site Manager sites without override", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(ok({ data: [{ siteId: "A" }, { siteId: "B" }] }));
    const d = new Discovery(client, {});
    await expect(d.siteManagerSiteId()).rejects.toThrow(/multiple.*UNIFI_SITE_MANAGER_SITE_ID/i);
  });

  it("deduplicates concurrent calls", async () => {
    const { client, request } = clientMock();
    let resolveFn!: (v: unknown) => void;
    request.mockReturnValueOnce(
      new Promise((r) => {
        resolveFn = r;
      }),
    );
    const d = new Discovery(client, {});
    const a = d.consoleId();
    const b = d.consoleId();
    resolveFn(ok({ data: [{ id: "Z", type: "console", owner: true }] }));
    expect(await a).toBe("Z");
    expect(await b).toBe("Z");
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("Discovery host types (N-42)", () => {
  it("falls back to the one owned ucore host when no console matches", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(
      ok({
        data: [
          { id: "U", type: "ucore", owner: true },
          { id: "N", type: "network-server", owner: true },
          { id: "V", type: "ucore", owner: false },
        ],
      }),
    );
    expect(await new Discovery(client, {}).consoleId()).toBe("U");
  });

  it("keeps preferring an owned console over a ucore host", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(
      ok({
        data: [
          { id: "U", type: "ucore", owner: true },
          { id: "C", type: "console", owner: true },
        ],
      }),
    );
    expect(await new Discovery(client, {}).consoleId()).toBe("C");
  });

  it("asks for UNIFI_CONSOLE_ID when several ucore hosts match", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(
      ok({
        data: [
          { id: "U1", type: "ucore", owner: true },
          { id: "U2", type: "ucore", owner: true },
        ],
      }),
    );
    await expect(new Discovery(client, {}).consoleId()).rejects.toThrow(/U1, U2.*UNIFI_CONSOLE_ID/);
  });
});
