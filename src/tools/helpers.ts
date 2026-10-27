import type { CallToolResult } from "@modelcontextprotocol/server";
import type { PaginationHint } from "../client/pagination.js";

export interface ResultOptions {
  pagination?: PaginationHint | undefined;
}

export function jsonResult(data: unknown, opts: ResultOptions = {}): CallToolResult {
  const out: { data: unknown; pagination?: PaginationHint } = { data };
  if (opts.pagination) out.pagination = opts.pagination;
  return {
    content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
  };
}

export function errorResult(message: string, details?: unknown): CallToolResult {
  const payload: { error: string; details?: unknown } = { error: message };
  if (details !== undefined) payload.details = details;
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: true,
  };
}

// Body fields whose value is hidden in confirm previews (audit N-22): passwords,
// WiFi passphrases and pre-shared keys, RADIUS and other secrets, tokens, API
// and private keys. Read results are not touched (see SECURITY.md).
const SECRET_KEYS =
  /(password|passphrase|secret|token|api[_-]?key|private[_-]?key|psk|wep[_-]?key)|^pre[_-]?shared[_-]?keys?$|^keys?$/i;

export function redactBody(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(redactBody);
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = SECRET_KEYS.test(k) ? "(redacted)" : redactBody(v);
    }
    return out;
  }
  return input;
}

/**
 * Tagged template for API paths: every interpolated value is encoded as a
 * single path segment, so an id containing "?", "#" or "/" cannot change the
 * target (audit N-2). Usage: apiPath`/v1/sites/${siteId}/devices/${deviceId}`.
 */
export function apiPath(strings: TemplateStringsArray, ...values: Array<string | number>): string {
  let out = strings[0] ?? "";
  values.forEach((v, i) => {
    out += encodeURIComponent(String(v)) + (strings[i + 1] ?? "");
  });
  return out;
}

/**
 * Maps an action name to the vendor discriminator form, so older inputs keep
 * working: "restart" -> "RESTART", "power-cycle" -> "POWER_CYCLE" (audit M-6).
 */
export function vendorAction(action: string): string {
  return action
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}
