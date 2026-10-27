import { MAX_UPSTREAM_ERROR_CHARS } from "../constants.js";
import { redactSecrets } from "../utils/logger.js";

export interface UnifiErrorPayload {
  statusCode: number;
  statusName?: string;
  code?: string;
  message: string;
  details?: unknown;
  cause?: unknown;
}

/** Codes set on UnifiApiError (statusCode 0) when no HTTP response was received. */
export const NETWORK_ERROR = "NETWORK_ERROR";
export const REDIRECT_REFUSED = "REDIRECT_REFUSED";
export const TIMEOUT = "TIMEOUT";
/** The caller cancelled the MCP request (audit N-64); never retried. */
export const CANCELLED = "CANCELLED";

/**
 * Socket-level causes that prove the request never reached the server, so
 * even a non-idempotent write is safe to resend.
 */
const PRE_CONNECT_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
]);

export class UnifiApiError extends Error {
  readonly statusCode: number;
  readonly statusName: string | undefined;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(p: UnifiErrorPayload) {
    super(
      `[${p.statusCode}${p.statusName ? " " + p.statusName : ""}] ${p.message}`,
      p.cause === undefined ? undefined : { cause: p.cause },
    );
    this.name = "UnifiApiError";
    this.statusCode = p.statusCode;
    this.statusName = p.statusName;
    this.code = p.code;
    this.details = p.details;
  }
}

/**
 * Wraps a failure from fetch() or from reading the response body (no HTTP
 * status available) into a UnifiApiError that keeps the original as `cause`.
 * A redirect refused by `redirect: "error"` gets its own code so it is never
 * retried; other failures carry `details.preConnect` for the retry policy.
 */
export function wrapNetworkError(err: unknown, method: string, url: string): UnifiApiError {
  const cause =
    err instanceof Error
      ? (err.cause as { code?: unknown; message?: unknown } | undefined)
      : undefined;
  const causeCode = typeof cause?.code === "string" ? cause.code : undefined;
  const causeMsg = typeof cause?.message === "string" ? cause.message : undefined;
  const reason = [err instanceof Error ? err.message : String(err), causeMsg]
    .filter(Boolean)
    .join(": ");
  if (causeMsg === "unexpected redirect") {
    return new UnifiApiError({
      statusCode: 0,
      code: REDIRECT_REFUSED,
      message: `${method} ${url} refused: the server answered with a redirect, which is never followed (the API key must not leave the configured host)`,
      cause: err,
    });
  }
  return new UnifiApiError({
    statusCode: 0,
    code: NETWORK_ERROR,
    message: `${method} ${url} failed: ${reason}${causeCode ? ` (${causeCode})` : ""}`,
    details: { causeCode, preConnect: causeCode !== undefined && PRE_CONNECT_CODES.has(causeCode) },
    cause: err,
  });
}

export function cancelledError(what: string, cause?: unknown): UnifiApiError {
  return new UnifiApiError({
    statusCode: 0,
    code: CANCELLED,
    message: `${what} cancelled by the caller`,
    cause,
  });
}

/**
 * Upstream text that reaches the caller (and the model): secrets scrubbed like
 * a log line, then cut to MAX_UPSTREAM_ERROR_CHARS (audit N-25).
 */
function upstreamText(text: string): string {
  const scrubbed = redactSecrets(text);
  return scrubbed.length > MAX_UPSTREAM_ERROR_CHARS
    ? `${scrubbed.slice(0, MAX_UPSTREAM_ERROR_CHARS)}... (truncated)`
    : scrubbed;
}

export function parseApiError(body: string, status: number): UnifiApiError {
  try {
    const parsed = JSON.parse(body) as Partial<UnifiErrorPayload>;
    if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
      return new UnifiApiError({
        statusCode: typeof parsed.statusCode === "number" ? parsed.statusCode : status,
        statusName:
          typeof parsed.statusName === "string" ? upstreamText(parsed.statusName) : undefined,
        code: typeof parsed.code === "string" ? upstreamText(parsed.code) : undefined,
        message: upstreamText(parsed.message),
        details: parsed.details,
      });
    }
  } catch {
    // fall through
  }
  return new UnifiApiError({
    statusCode: status,
    message: `HTTP ${status}${body ? `: ${upstreamText(body)}` : ""}`,
  });
}
