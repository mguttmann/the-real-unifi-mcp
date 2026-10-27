/**
 * Query encoding (audit N-43) and caller cancellation (audit N-35, N-64) of
 * the API client. `fetch` is a fake; nothing leaves the process.
 */
import { describe, expect, it, vi } from "vitest";
import { UnifiClient, encodeQuery } from "../../src/client/unifiClient.js";
import { UnifiApiError, CANCELLED, TIMEOUT } from "../../src/client/errors.js";
import { withRetry } from "../../src/client/retry.js";
import { runWithCallerSignal } from "../../src/client/callerSignal.js";
import { createLogger } from "../../src/utils/logger.js";

const cfg = {
  apiKey: "k",
  apiBase: "https://api.ui.com",
  confirmWrites: false,
  timeoutMs: 1000,
  logLevel: "error" as const,
};

function ok(): Response {
  return new Response('{"data":[]}', {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("query encoding (N-43)", () => {
  it("sends strings, numbers and booleans as before", () => {
    expect(encodeQuery({ a: "x y", b: 2, c: false, d: undefined, e: null })).toBe(
      "a=x+y&b=2&c=false",
    );
  });

  it("JSON-encodes a plain object instead of sending [object Object]", () => {
    expect(encodeQuery({ filter: { property: "name", op: "eq", value: "x" } })).toBe(
      "filter=" +
        encodeURIComponent('{"property":"name","op":"eq","value":"x"}').replace(/%20/g, "+"),
    );
  });

  it("sends an array as repeated keys", () => {
    expect(encodeQuery({ "hostIds[]": ["a", "b"] })).toBe("hostIds%5B%5D=a&hostIds%5B%5D=b");
  });

  it("the client uses the same encoding", async () => {
    const f = vi.fn(async () => ok());
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await c.request("GET", "/v1/devices", { query: { "hostIds[]": ["a", "b"], o: { k: 1 } } });
    const url = new URL((f.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.getAll("hostIds[]")).toEqual(["a", "b"]);
    expect(url.searchParams.get("o")).toBe('{"k":1}');
  });
});

/** A fetch that never answers until its signal aborts. */
function hangingFetch() {
  const signals: AbortSignal[] = [];
  const f = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const s = init.signal!;
        signals.push(s);
        s.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      }),
  );
  return { f, signals };
}

describe("caller cancellation (N-35, N-64)", () => {
  it("an explicit caller signal aborts fetch and is reported as CANCELLED, not TIMEOUT", async () => {
    const { f } = hangingFetch();
    const c = new UnifiClient({ ...cfg, timeoutMs: 60_000 }, createLogger("error"), {
      fetch: f as never,
    });
    const ac = new AbortController();
    const p = c.request("GET", "/v1/hosts", { signal: ac.signal });
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    ac.abort();
    const err = (await p.catch((e: unknown) => e)) as UnifiApiError;
    expect(err).toBeInstanceOf(UnifiApiError);
    expect(err.code).toBe(CANCELLED);
    // A GET is idempotent, but a cancelled call is never retried.
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("the timeout is still reported as TIMEOUT", async () => {
    const { f } = hangingFetch();
    const c = new UnifiClient({ ...cfg, timeoutMs: 20 }, createLogger("error"), {
      fetch: f as never,
    });
    const err = (await c
      .request("POST", "/v1/x", { body: {} })
      .catch((e: unknown) => e)) as UnifiApiError;
    expect(err.code).toBe(TIMEOUT);
  });

  it("the signal of the MCP request reaches fetch without being passed explicitly", async () => {
    const { f } = hangingFetch();
    const c = new UnifiClient({ ...cfg, timeoutMs: 60_000 }, createLogger("error"), {
      fetch: f as never,
    });
    const ac = new AbortController();
    const p = runWithCallerSignal(ac.signal, () => c.request("GET", "/v1/hosts"));
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    ac.abort();
    const err = (await p.catch((e: unknown) => e)) as UnifiApiError;
    expect(err.code).toBe(CANCELLED);
  });

  it("an already aborted signal sends no request", async () => {
    const f = vi.fn(async () => ok());
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    const err = (await c
      .request("GET", "/v1/hosts", { signal: AbortSignal.abort() })
      .catch((e: unknown) => e)) as UnifiApiError;
    expect(err.code).toBe(CANCELLED);
    expect(f).not.toHaveBeenCalled();
  });

  it("removes its abort listener from the caller signal after each attempt", async () => {
    const f = vi.fn(async () => ok());
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    const ac = new AbortController();
    const add = vi.spyOn(ac.signal, "addEventListener");
    const remove = vi.spyOn(ac.signal, "removeEventListener");
    for (let i = 0; i < 3; i++) await c.request("GET", "/v1/hosts", { signal: ac.signal });
    expect(add).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalledTimes(3);
  });

  it("a cancelled retry sleep stops at once and does not try again", async () => {
    const ac = new AbortController();
    const fn = vi.fn(async () => {
      throw new UnifiApiError({ statusCode: 429, message: "slow down", details: {} });
    });
    const started = Date.now();
    const p = withRetry(fn, { maxAttempts: 3, signal: ac.signal });
    setTimeout(() => ac.abort(), 20);
    const err = (await p.catch((e: unknown) => e)) as UnifiApiError;
    expect(err.code).toBe(CANCELLED);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

/**
 * A response whose stream body sends a first chunk and then stalls; fetch
 * ignores its signal, so only readBody can settle the call (review of 4422141).
 */
function stalledBodyFetch() {
  const cancel = vi.fn();
  let res!: Response;
  const f = vi.fn(async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"data":['));
      },
    });
    res = new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
    // The real cancel() rejects while text() holds the reader lock; the spy
    // records that readBody asks for it and keeps that behaviour.
    const real = res.body!.cancel.bind(res.body);
    cancel.mockImplementation((reason?: unknown) => real(reason));
    Object.defineProperty(res.body, "cancel", { value: cancel });
    return res;
  });
  return { f, cancel };
}

describe("abort during the body read (review of 4422141)", () => {
  it("the timeout settles a stalled stream body as TIMEOUT and cancels the body", async () => {
    const { f, cancel } = stalledBodyFetch();
    const c = new UnifiClient({ ...cfg, timeoutMs: 50 }, createLogger("error"), {
      fetch: f,
    });
    const started = Date.now();
    const err = (await c
      .request("GET", "/v1/hosts", { retry: { maxAttempts: 1 } })
      .catch((e: unknown) => e)) as UnifiApiError;
    expect(err).toBeInstanceOf(UnifiApiError);
    expect(err.code).toBe(TIMEOUT);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("a caller cancel while the body is read is CANCELLED, not TIMEOUT, and not retried", async () => {
    const { f, cancel } = stalledBodyFetch();
    const c = new UnifiClient({ ...cfg, timeoutMs: 60_000 }, createLogger("error"), {
      fetch: f,
    });
    const ac = new AbortController();
    const p = c.request("GET", "/v1/hosts", { signal: ac.signal });
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    // Let the response resolve, so the abort lands in the body read.
    await new Promise((r) => setTimeout(r, 10));
    ac.abort();
    const err = (await p.catch((e: unknown) => e)) as UnifiApiError;
    expect(err).toBeInstanceOf(UnifiApiError);
    expect(err.code).toBe(CANCELLED);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("cancellation through MCP (N-35)", () => {
  it("cancelling tools/call aborts the API request of the tool", async () => {
    const { connectInProcess } = await import("../contract/liveTools.js");
    const { f, signals } = hangingFetch();
    vi.stubGlobal("fetch", f);
    const { client, close } = await connectInProcess({ timeoutMs: 60_000 });
    try {
      const ac = new AbortController();
      const call = client
        .callTool({ name: "unifi_sm_list_hosts", arguments: {} }, { signal: ac.signal })
        .catch((e: unknown) => e);
      await vi.waitFor(() => expect(signals).toHaveLength(1));
      ac.abort();
      await call;
      await vi.waitFor(() => expect(signals[0]!.aborted).toBe(true));
      expect(f).toHaveBeenCalledTimes(1);
    } finally {
      await close();
      vi.unstubAllGlobals();
    }
  });
});
