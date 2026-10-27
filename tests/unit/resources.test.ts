import { describe, expect, it, vi } from "vitest";
import { registerIdentityResource } from "../../src/resources/identity.js";
import { registerHostsResources } from "../../src/resources/hosts.js";

function ctxMock() {
  return {
    cfg: {} as never,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    client: { request: vi.fn() } as never,
    discovery: {
      identity: vi
        .fn()
        .mockResolvedValue({ consoleId: "C1", networkSiteId: "N1", siteManagerSiteId: "S1" }),
    } as never,
  };
}

describe("resources", () => {
  it("registers unifi-identity", () => {
    const names: string[] = [];
    const server = { registerResource: (name: string) => names.push(name) } as never;
    registerIdentityResource(server, ctxMock() as never);
    expect(names).toContain("unifi-identity");
  });

  it("registers unifi-hosts and unifi-host-detail", () => {
    const names: string[] = [];
    const server = { registerResource: (name: string) => names.push(name) } as never;
    registerHostsResources(server, ctxMock() as never);
    expect(names).toEqual(expect.arrayContaining(["unifi-hosts", "unifi-host-detail"]));
  });
});
