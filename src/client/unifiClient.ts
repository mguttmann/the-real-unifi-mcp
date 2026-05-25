import { UnifiApiError, parseApiError } from "./errors.js";
import { withRetry, parseRetryAfter } from "./retry.js";
import { parsePaginationHint, type PaginationHint } from "./pagination.js";
import type { Config } from "../config.js";
import type { Logger } from "../utils/logger.js";
import { NETWORK_PROXY_PREFIX } from "../constants.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  idempotent?: boolean;
  retry?: { maxAttempts?: number };
  signal?: AbortSignal;
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
    const maxAttempts = options.retry?.maxAttempts ?? this.defaultAttempts(method, options.idempotent);
    const idempotent = options.idempotent ?? (method === "GET");
    return withRetry(() => this.doRequest<T>(method, url, options), { maxAttempts, idempotent });
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

  private defaultAttempts(_method: HttpMethod, _idempotent?: boolean): number {
    return 3;  // 429 always retries; 5xx is gated inside isRetriable
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const u = new URL(path, this.cfg.apiBase);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }

  private async doRequest<T>(
    method: HttpMethod,
    url: string,
    options: RequestOptions,
  ): Promise<UnifiResponse<T>> {
    const headers: Record<string, string> = {
      "X-API-Key": this.cfg.apiKey,
      Accept: "application/json",
      ...(options.headers ?? {}),
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const f = this.opts.fetch ?? globalThis.fetch;
    const started = Date.now();
    let res: Response;
    try {
      res = await f(url, { method, headers, body, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new UnifiApiError({ statusCode: 0, message: `request to ${url} aborted (timeout ${this.cfg.timeoutMs}ms)` });
      }
      throw err;
    }
    clearTimeout(timer);

    this.logger.debug(`${method} ${url} → ${res.status} (${Date.now() - started}ms)`);

    if (res.status === 204) {
      return { data: null as T, status: res.status, headers: res.headers };
    }

    const text = await res.text();

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
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    } else {
      parsed = text;
    }

    const pagination = parsePaginationHint(parsed) ?? undefined;
    return { data: parsed as T, status: res.status, headers: res.headers, pagination };
  }
}
