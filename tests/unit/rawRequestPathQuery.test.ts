import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { UnifiClient, withQuery } from "../../src/client/unifiClient.js";
import { registerRawRequestTool } from "../../src/tools/rawRequest.js";
import type { ServerContext } from "../../src/server.js";
import { createLogger } from "../../src/utils/logger.js";

// A query string already in `path` must survive an extra `query` argument,
// in the request that is sent and in the confirm preview (0.2.1 behaviour).

const cfg = {
  apiKey: "k",
  apiBase: "http://127.0.0.1:1",
  confirmWrites: true,
  timeoutMs: 1000,
  logLevel: "error" as const,
};

function setup() {
  const f = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
  const logger = createLogger("error");
  const client = new UnifiClient(cfg, logger, { fetch: f });
  const ctx = {
    cfg,
    logger,
    client,
    discovery: {} as ServerContext["discovery"],
  } as unknown as ServerContext;
  let handler!: (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>;
  const server = {
    registerTool: (_n: string, _d: unknown, h: typeof handler) => {
      handler = h;
    },
  } as unknown as McpServer;
  registerRawRequestTool(server, ctx);
  return { f, call: (a: Record<string, unknown>) => handler(a) };
}

const sentUrl = (f: ReturnType<typeof vi.fn>) => new URL(String(f.mock.calls[0]?.[0]));

describe("unifi_raw_request: query in path plus query argument", () => {
  it("keeps the path filter on a confirmed DELETE", async () => {
    const { f, call } = setup();
    await call({
      method: "DELETE",
      path: "/v1/x/hotspot/vouchers?filter=expired.eq(true)",
      query: { x: "1" },
      confirm: "YES",
    });
    const u = sentUrl(f);
    expect(u.pathname).toBe("/v1/x/hotspot/vouchers");
    expect(u.searchParams.get("filter")).toBe("expired.eq(true)");
    expect(u.searchParams.get("x")).toBe("1");
  });

  it("keeps pageSize on a GET with nextToken", async () => {
    const { f, call } = setup();
    await call({ method: "GET", path: "/v1/hosts?pageSize=1", query: { nextToken: "abc" } });
    const u = sentUrl(f);
    expect(u.searchParams.get("pageSize")).toBe("1");
    expect(u.searchParams.get("nextToken")).toBe("abc");
  });

  it("lets a query key replace the same key in the path, as 0.2.1 did", async () => {
    const { f, call } = setup();
    await call({ method: "GET", path: "/v1/hosts?pageSize=1", query: { pageSize: 5 } });
    expect(sentUrl(f).searchParams.getAll("pageSize")).toEqual(["5"]);
  });

  it("preview shows exactly the URL that is sent after confirm", async () => {
    const { f, call } = setup();
    const args = {
      method: "DELETE",
      path: "/v1/x/hotspot/vouchers?filter=expired.eq(true)",
      query: { x: "1" },
    };
    const preview = await call(args);
    expect(f).not.toHaveBeenCalled();
    const text = preview.content.map((c) => c.text).join("\n");
    const expected = withQuery(args.path, args.query);
    expect(expected.split("?").length).toBe(2);
    expect(text).toContain(expected);
    await call({ ...args, confirm: "YES" });
    const u = sentUrl(f);
    expect(u.pathname + u.search).toBe(expected);
  });

  it("withQuery leaves a path without query arguments untouched", () => {
    expect(withQuery("/v1/hosts?pageSize=1", undefined)).toBe("/v1/hosts?pageSize=1");
    expect(withQuery("/v1/hosts", { a: [1, 2] })).toBe("/v1/hosts?a=1&a=2");
  });
});
