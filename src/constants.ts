export const DEFAULT_API_BASE = "https://api.ui.com";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_LOG_LEVEL = "info" as const;

export const SERVER_NAME = "the-real-unifi-mcp";
export const SERVER_VERSION = "0.1.1";

export const NETWORK_PROXY_PREFIX = "/proxy/network/integration";

export const RETRY = {
  BACKOFF_MS: [1000, 2000, 4000] as const,
  RETRY_AFTER_CEILING_MS: 60_000,
};
