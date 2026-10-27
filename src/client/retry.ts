import { UnifiApiError, NETWORK_ERROR } from "./errors.js";
import { RETRY } from "../constants.js";

export interface RetryOptions {
  maxAttempts: number;
  sleep?: (ms: number) => Promise<void>;
  idempotent?: boolean; // when false, 5xx and after-send network errors are not retried
}

export function computeBackoff(attempt: number): number {
  const sched = RETRY.BACKOFF_MS;
  const idx = Math.min(attempt, sched.length - 1);
  return sched[idx]!;
}

export function parseRetryAfter(header: string | undefined | null): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    const ms = Number(trimmed) * 1000;
    return Math.min(ms, RETRY.RETRY_AFTER_CEILING_MS);
  }
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) {
    const ms = Math.max(0, date - Date.now());
    return Math.min(ms, RETRY.RETRY_AFTER_CEILING_MS);
  }
  return null;
}

const DEFAULT_SLEEP = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function isRetriable(err: unknown, opts: { idempotent?: boolean } = {}): boolean {
  if (err instanceof UnifiApiError) {
    if (err.statusCode === 429) return true; // always retry 429
    if (err.statusCode >= 500 && err.statusCode !== 501) {
      return opts.idempotent === true; // 5xx only if idempotent
    }
    if (err.statusCode === 0 && err.code === NETWORK_ERROR) {
      // A write may already have been processed when the connection dropped
      // after sending; only resend it when the request never left the client.
      const preConnect = (err.details as { preConnect?: boolean } | undefined)?.preConnect === true;
      return preConnect || opts.idempotent === true;
    }
    return false; // redirect, timeout, guard errors
  }
  if (err instanceof Error) {
    return (
      opts.idempotent === true && /ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(err.message)
    );
  }
  return false;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? DEFAULT_SLEEP;
  let lastErr: unknown;
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === opts.maxAttempts - 1 || !isRetriable(err, { idempotent: opts.idempotent }))
        throw err;
      const retryAfter =
        err instanceof UnifiApiError && err.statusCode === 429
          ? (err.details as { retryAfterMs?: number } | undefined)?.retryAfterMs
          : undefined;
      const delay = retryAfter ?? computeBackoff(attempt);
      await sleep(delay);
    }
  }
  throw lastErr;
}
