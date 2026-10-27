import {
  UnifiApiError,
  parseApiError,
  wrapNetworkError,
  TIMEOUT,
  cancelledError,
} from "./errors.js";
import { callerSignal } from "./callerSignal.js";
import { withRetry, parseRetryAfter } from "./retry.js";
import { parsePaginationHint, type PaginationHint } from "./pagination.js";
import type { Config } from "../config.js";
import type { Logger } from "../utils/logger.js";
import { NETWORK_PROXY_PREFIX, RETRY } from "../constants.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  idempotent?: boolean;
  retry?: { maxAttempts?: number };
  /**
   * Caller cancellation (audit N-35). Unset: the signal of the MCP request
   * being handled (`callerSignal()`); `null`: none (shared discovery lookups,
   * which other calls may be waiting for).
   */
  signal?: AbortSignal | null;
}

export interface UnifiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  pagination?: PaginationHint;
}

export interface UnifiClientOptions {
  fetch?: typeof globalThis.fetch;
}

/**
 * Rejects any path that could redirect the request away from the configured
 * apiBase host: absolute URLs ("://"), protocol-relative ("//…"), userinfo
 * ("@"), backslash tricks, control characters and dot-segment traversal
 * (".." incl. "%2e"-encoded).
 */
function assertSafePath(path: string): void {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new UnifiApiError({
      statusCode: 0,
      message: `invalid path ${JSON.stringify(path)}: must be a relative path starting with "/"`,
    });
  }
  // WHATWG URL drops tab/LF/CR while parsing, so ".\t." would turn into ".."
  // after this check (audit N-1). Refuse every C0 control character and DEL.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) {
    throw new UnifiApiError({
      statusCode: 0,
      message: `invalid path ${JSON.stringify(path)}: control characters are not allowed`,
    });
  }
  const lowered = path.toLowerCase();
  if (
    path.startsWith("//") ||
    lowered.includes("://") ||
    lowered.includes("@") ||
    lowered.includes("\\") ||
    lowered.split("%2e").join(".").includes("..")
  ) {
    throw new UnifiApiError({
      statusCode: 0,
      message: `invalid path ${JSON.stringify(path)}: "//", "://", "..", "@" and "\\" are not allowed`,
    });
  }
}

/**
 * Query string as sent (audit N-43): strings, numbers and booleans as text, a
 * plain object as JSON, an array as one `key=value` pair per element;
 * `undefined` and `null` are left out. Also used for confirm previews, so a
 * preview shows the query exactly as it would be sent (audit N-26).
 */
export function encodeQuery(query: Record<string, unknown> | undefined): string {
  const params = new URLSearchParams();
  const one = (v: unknown): string =>
    v !== null && typeof v === "object" ? JSON.stringify(v) : String(v);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item !== undefined && item !== null) params.append(k, one(item));
    } else params.append(k, one(v));
  }
  return params.toString();
}

export class UnifiClient {
  constructor(
    private cfg: Config,
    private logger: Logger,
    private opts: UnifiClientOptions = {},
  ) {}

  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<UnifiResponse<T>> {
    const url = this.buildUrl(path, options.query);
    const maxAttempts = options.retry?.maxAttempts ?? RETRY.MAX_ATTEMPTS;
    // Only GET is treated as idempotent by default: a POST/PUT/PATCH/DELETE
    // is not resent after a 5xx or a dropped connection (M-2).
    const idempotent = options.idempotent ?? method === "GET";
    const signal = options.signal === undefined ? callerSignal() : (options.signal ?? undefined);
    if (signal?.aborted) throw cancelledError(`${method} ${url}`);
    return withRetry(() => this.doRequest<T>(method, url, options, signal), {
      maxAttempts,
      idempotent,
      signal,
    });
  }

  async requestNetwork<T = unknown>(
    method: HttpMethod,
    consoleId: string,
    docPath: string,
    options: RequestOptions = {},
  ): Promise<UnifiResponse<T>> {
    const path = `/v1/connector/consoles/${encodeURIComponent(consoleId)}${NETWORK_PROXY_PREFIX}${docPath.startsWith("/") ? "" : "/"}${docPath}`;
    return this.request<T>(method, path, options);
  }

  private apiOrigin(): string {
    return new URL(this.cfg.apiBase).origin;
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    assertSafePath(path);
    // Concatenating onto the configured origin pins the target host:
    // `new URL(path, base)` would let an absolute/protocol-relative `path`
    // override it and leak the API key to an attacker-chosen host.
    const origin = this.apiOrigin();
    const u = new URL(origin + path);
    if (u.origin !== origin) {
      throw new UnifiApiError({
        statusCode: 0,
        message: `refusing request: resolved host ${u.origin} does not match configured apiBase ${origin}`,
      });
    }
    const qs = encodeQuery(query);
    if (qs) u.search = qs;
    return u.toString();
  }

  private async doRequest<T>(
    method: HttpMethod,
    url: string,
    options: RequestOptions,
    signal: AbortSignal | undefined,
  ): Promise<UnifiResponse<T>> {
    if (signal?.aborted) throw cancelledError(`${method} ${url}`);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers ?? {}),
    };
    // Defense in depth: attach the credential ONLY when the request actually
    // targets the configured apiBase host (buildUrl already guarantees this).
    if (new URL(url).origin === this.apiOrigin()) {
      headers["X-API-Key"] = this.cfg.apiKey;
    }
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener("abort", onCallerAbort, { once: true });

    const f = this.opts.fetch ?? globalThis.fetch;
    const started = Date.now();
    let res: Response;
    let text: string | null;
    try {
      // redirect: "error" (#53): X-API-Key is a custom header; with the
      // default redirect:"follow" undici would forward it to the target host
      // of a cross-origin redirect (it strips Authorization, not custom
      // headers). An API call never legitimately follows a redirect, so abort.
      res = await f(url, { method, headers, body, signal: controller.signal, redirect: "error" });
      this.logger.debug(`${method} ${url} → ${res.status} (${Date.now() - started}ms)`);
      // The timeout also covers the body read, so a stalled body cannot hang the call (N-5).
      text = res.status === 204 ? null : await res.text();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // The caller's cancellation is not a timeout (audit N-64).
        if (signal?.aborted) throw cancelledError(`${method} ${url}`, err);
        throw new UnifiApiError({
          statusCode: 0,
          code: TIMEOUT,
          message: `request to ${url} aborted (timeout ${this.cfg.timeoutMs}ms)`,
          cause: err,
        });
      }
      const wrapped = wrapNetworkError(err, method, url);
      this.logger.warn(wrapped.message);
      throw wrapped;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onCallerAbort);
    }

    if (text === null) {
      return { data: null as T, status: res.status, headers: res.headers };
    }

    if (!res.ok) {
      const err = parseApiError(text, res.status);
      if (res.status === 429) {
        const retryAfterMs = parseRetryAfter(res.headers.get("retry-after")) ?? undefined;
        (err as unknown as { details: unknown }).details = { retryAfterMs };
      }
      throw err;
    }

    const ct = res.headers.get("content-type") ?? "";
    let parsed: unknown = null;
    if (ct.includes("application/json") && text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    } else {
      parsed = text;
    }

    const pagination = parsePaginationHint(parsed) ?? undefined;
    return { data: parsed as T, status: res.status, headers: res.headers, pagination };
  }
}
