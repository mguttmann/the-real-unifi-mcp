import { describe, expect, it, vi } from "vitest";
import { withRetry, computeBackoff, parseRetryAfter } from "../../src/client/retry.js";
import { UnifiApiError } from "../../src/client/errors.js";

describe("computeBackoff", () => {
  it("returns the indexed delay from the schedule", () => {
    expect(computeBackoff(0)).toBe(1000);
    expect(computeBackoff(1)).toBe(2000);
    expect(computeBackoff(2)).toBe(4000);
  });
  it("clamps to last entry beyond the schedule", () => {
    expect(computeBackoff(99)).toBe(4000);
  });
});

describe("parseRetryAfter", () => {
  it("parses seconds form", () => {
    expect(parseRetryAfter("3")).toBe(3000);
  });
  it("parses HTTP-date form", () => {
    const inThreeSec = new Date(Date.now() + 3000).toUTCString();
    const ms = parseRetryAfter(inThreeSec);
    expect(ms).toBeGreaterThan(2000);
    expect(ms).toBeLessThan(4000);
  });
  it("returns null for garbage", () => {
    expect(parseRetryAfter("garbage")).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
  });
  it("clamps to 60s ceiling", () => {
    expect(parseRetryAfter("999")).toBe(60_000);
  });
});

describe("withRetry", () => {
  it("succeeds on first attempt without delay", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const out = await withRetry(fn, { maxAttempts: 3, sleep: vi.fn() });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 then succeeds", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new UnifiApiError({ statusCode: 429, message: "rate limited" });
      return "ok";
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const out = await withRetry(fn, { maxAttempts: 3, sleep });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry 4xx other than 429", async () => {
    const fn = vi.fn().mockRejectedValue(new UnifiApiError({ statusCode: 400, message: "bad" }));
    await expect(withRetry(fn, { maxAttempts: 3, sleep: vi.fn() })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx then gives up", async () => {
    const fn = vi.fn().mockRejectedValue(new UnifiApiError({ statusCode: 502, message: "bad gateway" }));
    await expect(withRetry(fn, { maxAttempts: 3, idempotent: true, sleep: vi.fn() })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("retries 429 even when not idempotent", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new UnifiApiError({ statusCode: 429, message: "slow" });
      return "ok";
    });
    const out = await withRetry(fn, { maxAttempts: 3, idempotent: false, sleep: vi.fn() });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry 5xx when not idempotent", async () => {
    const fn = vi.fn().mockRejectedValue(new UnifiApiError({ statusCode: 502, message: "bad" }));
    await expect(withRetry(fn, { maxAttempts: 3, idempotent: false, sleep: vi.fn() })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries network errors", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 2) throw new Error("fetch failed: ECONNRESET");
      return "ok";
    });
    const out = await withRetry(fn, { maxAttempts: 3, idempotent: false, sleep: vi.fn() });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
