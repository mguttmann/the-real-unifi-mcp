import { UnifiApiError, NETWORK_ERROR, cancelledError } from "./errors.js";
import { RETRY } from "../constants.js";

export interface RetryOptions {
  maxAttempts: number;
  sleep?: (ms: number) => Promise<void>;
  idempotent?: boolean; // when false, 5xx and after-send network errors are not retried
  /** Caller cancellation (audit N-35): stops a pending retry sleep at once. */
  signal?: AbortSignal;
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

/**
 * Sleeps `ms`; with a signal it rejects with CANCELLED as soon as the signal
 * aborts and clears its timer and listener. An injected `sleep` (tests) is
 * raced against the signal.
 */
function sleepFor(
  ms: number,
  signal: AbortSignal | undefined,
  sleep: ((ms: number) => Promise<void>) | undefined,
): Promise<void> {
  if (signal?.aborted) return Promise.reject(cancelledError("retry"));
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      if (timer !== undefined) clearTimeout(timer);
      reject(cancelledError("retry"));
    };
    const done = (err?: unknown) => {
      signal?.removeEventListener("abort", onAbort);
      if (err === undefined) resolve();
      else reject(err);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    if (sleep) Promise.resolve(sleep(ms)).then(() => done(), done);
    else timer = setTimeout(() => done(), ms);
  });
}

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
  // At least one attempt; the last attempt (or a non-retriable error) rethrows,
  // so the loop never falls through.
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= opts.maxAttempts - 1 || !isRetriable(err, { idempotent: opts.idempotent }))
        throw err;
      const retryAfter =
        err instanceof UnifiApiError && err.statusCode === 429
          ? (err.details as { retryAfterMs?: number } | undefined)?.retryAfterMs
          : undefined;
      const delay = retryAfter ?? computeBackoff(attempt);
      await sleepFor(delay, opts.signal, opts.sleep);
    }
  }
}
