import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UnifiClient } from "../../src/client/unifiClient.js";
import { UnifiApiError } from "../../src/client/errors.js";
import { createLogger } from "../../src/utils/logger.js";

const cfg = {
  apiKey: "k",
  apiBase: "https://api.ui.com",
  confirmWrites: false,
  timeoutMs: 1000,
  logLevel: "error" as const,
};

function mockFetch(impl: (req: { url: string; init: RequestInit }) => Promise<Response>) {
  return vi.fn().mockImplementation((url: string, init: RequestInit = {}) => impl({ url, init }));
}

describe("UnifiClient.request", () => {
  it("sends X-API-Key header on every call", async () => {
    const f = mockFetch(
      async () =>
        new Response('{"data":[]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await c.request("GET", "/v1/hosts");
    expect(f).toHaveBeenCalledWith(
      "https://api.ui.com/v1/hosts",
      expect.objectContaining({ headers: expect.objectContaining({ "X-API-Key": "k" }) }),
    );
  });

  it("returns parsed JSON data with pagination hint when present", async () => {
    const body = { data: [1, 2], offset: 0, limit: 2, count: 2, totalCount: 10 };
    const f = mockFetch(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    const res = await c.request("GET", "/v1/x");
    expect(res.data).toEqual(body);
    expect(res.pagination?.hasMore).toBe(true);
    expect(res.pagination?.nextOffset).toBe(2);
  });

  it("serializes JSON body and sets Content-Type", async () => {
    let captured: RequestInit | undefined;
    const f = mockFetch(async ({ init }) => {
      captured = init;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await c.request("POST", "/v1/x", { body: { hello: "world" } });
    expect(captured?.body).toBe('{"hello":"world"}');
    expect((captured?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("appends query parameters", async () => {
    const f = mockFetch(
      async () =>
        new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await c.request("GET", "/v1/x", { query: { offset: 5, limit: 10, filter: undefined } });
    const url = String(f.mock.calls[0]?.[0]);
    expect(url).toContain("offset=5");
    expect(url).toContain("limit=10");
    expect(url).not.toContain("filter=");
  });

  it("returns null for 204 No Content", async () => {
    const f = mockFetch(async () => new Response(null, { status: 204 }));
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    const res = await c.request("DELETE", "/v1/x");
    expect(res.data).toBeNull();
    expect(res.status).toBe(204);
  });

  it("throws UnifiApiError on 4xx", async () => {
    const body = JSON.stringify({
      statusCode: 404,
      statusName: "NOT_FOUND",
      code: "x",
      message: "nope",
    });
    const f = mockFetch(
      async () =>
        new Response(body, { status: 404, headers: { "content-type": "application/json" } }),
    );
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await expect(c.request("GET", "/v1/x")).rejects.toBeInstanceOf(UnifiApiError);
  });

  it("rejects host-override paths without ever calling fetch (SSRF guard)", async () => {
    const f = mockFetch(async () => new Response("{}", { status: 200 }));
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    const attacks = [
      "https://evil.example/v1/hosts", // absolute URL
      "//evil.example/v1/hosts", // protocol-relative
      "/v1/hosts@evil.example", // userinfo trick
      "/..%2F..%2Fadmin", // encoded traversal
      "/v1/../../admin", // dot-segment traversal
      "/\\evil.example/", // backslash trick
      "v1/hosts", // missing leading slash
    ];
    for (const path of attacks) {
      await expect(c.request("GET", path)).rejects.toBeInstanceOf(UnifiApiError);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("pins requests to the configured apiBase host", async () => {
    const f = mockFetch(
      async () =>
        new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await c.request("GET", "/v1/hosts");
    const url = new URL(String(f.mock.calls[0]?.[0]));
    expect(url.origin).toBe("https://api.ui.com");
  });

  it("attaches Retry-After to error.details on 429", async () => {
    const f = mockFetch(
      async () =>
        new Response(JSON.stringify({ statusCode: 429, message: "slow" }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "2" },
        }),
    );
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await expect(c.request("GET", "/v1/x", { retry: { maxAttempts: 1 } })).rejects.toMatchObject({
      statusCode: 429,
      details: expect.objectContaining({ retryAfterMs: 2000 }),
    });
  });
});

describe("UnifiClient against a local socket server (M-2, N-5, N-21)", () => {
  let server: http.Server;
  let base: string;
  const hits: Record<string, number> = {};

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const path = (req.url ?? "").split("?")[0]!;
      hits[`${req.method} ${path}`] = (hits[`${req.method} ${path}`] ?? 0) + 1;
      if (path === "/redir") {
        res.writeHead(302, { location: "http://127.0.0.1:9/elsewhere" });
        res.end();
      } else if (path === "/reset") {
        // Read the full request (the write reached the server), then drop the socket.
        req.resume();
        req.on("end", () => req.socket.destroy());
      } else if (path === "/stall") {
        res.writeHead(200, { "content-type": "application/json" });
        res.write("{"); // headers sent, body never finishes
      } else {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  });

  const client = (timeoutMs = 1000, logger = createLogger("error")) =>
    new UnifiClient({ ...cfg, apiBase: base, timeoutMs }, logger);

  it("sends a POST exactly once when the connection drops after the server read it", async () => {
    hits["POST /reset"] = 0;
    const err = await client()
      .request("POST", "/reset", { body: { a: 1 } })
      .catch((e: unknown) => e);
    expect(hits["POST /reset"]).toBe(1);
    expect(err).toBeInstanceOf(UnifiApiError);
    expect(err).toMatchObject({ statusCode: 0, code: "NETWORK_ERROR" });
    expect((err as Error).message).toContain("other side closed");
  });

  it("does not retry PUT, PATCH or DELETE after the request may have reached the server", async () => {
    for (const m of ["PUT", "PATCH", "DELETE"] as const) {
      hits[`${m} /reset`] = 0;
      await expect(client().request(m, "/reset", { body: {} })).rejects.toBeInstanceOf(
        UnifiApiError,
      );
      expect(hits[`${m} /reset`]).toBe(1);
    }
  });

  it("still retries an idempotent GET on a dropped connection", async () => {
    hits["GET /reset"] = 0;
    await expect(
      client().request("GET", "/reset", { retry: { maxAttempts: 2 } }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(hits["GET /reset"]).toBe(2);
  });

  it("resends a POST when the connection was refused (request never left the client)", async () => {
    const tmp = http.createServer();
    await new Promise<void>((r) => tmp.listen(0, "127.0.0.1", r));
    const port = (tmp.address() as AddressInfo).port;
    await new Promise<void>((r) => tmp.close(() => r()));
    let calls = 0;
    const counting: typeof fetch = (input, init) => {
      calls++;
      return fetch(input, init);
    };
    const c = new UnifiClient(
      { ...cfg, apiBase: `http://127.0.0.1:${port}` },
      createLogger("error"),
      { fetch: counting },
    );
    await expect(
      c.request("POST", "/x", { body: {}, retry: { maxAttempts: 2 } }),
    ).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      details: { causeCode: "ECONNREFUSED", preConnect: true },
    });
    expect(calls).toBe(2);
  });

  it("wraps a refused redirect in UnifiApiError, does not retry it, and logs a warning", async () => {
    hits["GET /redir"] = 0;
    const warn = vi.fn();
    const logger = { ...createLogger("error"), warn };
    const err = await client(1000, logger)
      .request("GET", "/redir")
      .catch((e: unknown) => e);
    expect(hits["GET /redir"]).toBe(1);
    expect(err).toMatchObject({ statusCode: 0, code: "REDIRECT_REFUSED" });
    expect((err as Error).message).toContain("redirect");
    expect((err as Error).cause).toBeInstanceOf(Error);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("/redir"));
  });

  it("applies the timeout to the body read, not only to the headers", async () => {
    const started = Date.now();
    const err = await client(200)
      .request("GET", "/stall", { retry: { maxAttempts: 1 } })
      .catch((e: unknown) => e);
    expect(Date.now() - started).toBeLessThan(3000);
    expect(err).toMatchObject({ statusCode: 0, code: "TIMEOUT" });
  });
});
