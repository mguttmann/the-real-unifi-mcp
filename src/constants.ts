import { createRequire } from "node:module";

export const DEFAULT_API_BASE = "https://api.ui.com";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_LOG_LEVEL = "info" as const;

export const SERVER_NAME = "the-real-unifi-mcp";
// serverInfo.version comes from package.json, so a release bump cannot drift
// (audit N-13). src/ and dist/ both sit one level below the package root.
export const SERVER_VERSION: string = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;

// Largest combined number of array elements and object members one tools/call
// `arguments` payload may contain (SDK >= 1.32 option, audit N-33). Unset means
// no limit. Real inputs (a MAC list, one policy body) stay far below it.
export const MAX_TOOL_INPUT_ELEMENTS = 100_000;

// Longest upstream error text (JSON message or raw body) passed on to the
// caller; longer text is cut and marked "(truncated)" (audit N-25).
export const MAX_UPSTREAM_ERROR_CHARS = 500;

export const NETWORK_PROXY_PREFIX = "/proxy/network/integration";

export const RETRY = {
  // Total attempts per request (first try included). What may be retried is
  // decided by isRetriable in src/client/retry.ts.
  MAX_ATTEMPTS: 3,
  BACKOFF_MS: [1000, 2000, 4000] as const,
  RETRY_AFTER_CEILING_MS: 60_000,
};
