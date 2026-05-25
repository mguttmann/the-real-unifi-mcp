export const DEFAULT_API_BASE = "https://api.ui.com";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_LOG_LEVEL = "info" as const;

export const SERVER_NAME = "the-real-unifi-mcp";
export const SERVER_VERSION = "0.1.0";

export const NETWORK_PROXY_PREFIX = "/proxy/network/integration";

export const RETRY = {
  MAX_429_ATTEMPTS: 3,
  MAX_5XX_ATTEMPTS: 2,
  MAX_NETWORK_ATTEMPTS: 1,
  BACKOFF_MS: [1000, 2000, 4000] as const,
  NETWORK_BACKOFF_MS: 500,
  RETRY_AFTER_CEILING_MS: 60_000,
};
