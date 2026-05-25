import { describe, expect, it, vi } from "vitest";
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
    const f = mockFetch(async () => new Response('{"data":[]}', { status: 200, headers: { "content-type": "application/json" } }));
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await c.request("GET", "/v1/hosts");
    expect(f).toHaveBeenCalledWith(
      "https://api.ui.com/v1/hosts",
      expect.objectContaining({ headers: expect.objectContaining({ "X-API-Key": "k" }) }),
    );
  });

  it("returns parsed JSON data with pagination hint when present", async () => {
    const body = { data: [1, 2], offset: 0, limit: 2, count: 2, totalCount: 10 };
    const f = mockFetch(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
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
    const f = mockFetch(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
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
    const body = JSON.stringify({ statusCode: 404, statusName: "NOT_FOUND", code: "x", message: "nope" });
    const f = mockFetch(async () => new Response(body, { status: 404, headers: { "content-type": "application/json" } }));
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await expect(c.request("GET", "/v1/x")).rejects.toBeInstanceOf(UnifiApiError);
  });

  it("attaches Retry-After to error.details on 429", async () => {
    const f = mockFetch(async () =>
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
