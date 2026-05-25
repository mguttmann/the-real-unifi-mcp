import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
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

const SECRET_KEYS = /(password|secret|token|api[_-]?key)/i;

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
