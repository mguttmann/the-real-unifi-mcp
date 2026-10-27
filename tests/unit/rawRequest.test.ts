import { describe, expect, it, vi } from "vitest";
import { registerRawRequestTool } from "../../src/tools/rawRequest.js";
import type { ServerContext } from "../../src/server.js";
import type { McpServer } from "@modelcontextprotocol/server";

function ctxMock(extra?: Partial<ServerContext>): ServerContext {
  return {
    cfg: {
      confirmWrites: false,
      apiKey: "",
      apiBase: "https://api.ui.com",
      logLevel: "error",
      timeoutMs: 1000,
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    client: { request: vi.fn() } as unknown as ServerContext["client"],
    discovery: {} as ServerContext["discovery"],
    ...extra,
  };
}

describe("unifi_raw_request", () => {
  it("registers a tool named unifi_raw_request", () => {
    const tools: Record<string, unknown> = {};
    // registerTool(name, config, cb): SDK signature
    const server = {
      registerTool: (name: string, def: unknown, _cb: unknown) => {
        tools[name] = def;
      },
    } as unknown as McpServer;
    registerRawRequestTool(server, ctxMock());
    expect(tools["unifi_raw_request"]).toBeDefined();
  });

  it("passes method/path/body to client.request", async () => {
    const reqFn = vi
      .fn()
      .mockResolvedValue({ data: { ok: true }, status: 200, headers: new Headers() });
    const ctx = ctxMock({ client: { request: reqFn } as unknown as ServerContext["client"] });
    let handler!: (args: Record<string, unknown>) => Promise<unknown>;
    const server = {
      registerTool: (_n: string, _def: unknown, h: typeof handler) => {
        handler = h;
      },
    } as unknown as McpServer;
    registerRawRequestTool(server, ctx);
    await handler({ method: "POST", path: "/v1/x", body: { a: 1 } });
    expect(reqFn).toHaveBeenCalledWith(
      "POST",
      "/v1/x",
      expect.objectContaining({ body: { a: 1 } }),
    );
  });
});
