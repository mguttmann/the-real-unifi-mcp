import { z } from "zod";
import { DEFAULT_API_BASE, DEFAULT_TIMEOUT_MS, DEFAULT_LOG_LEVEL } from "./constants.js";

const truthy = new Set(["true", "1", "yes"]);
const parseBool = (v: string | undefined, dflt = false): boolean => {
  if (v === undefined) return dflt;
  return truthy.has(v.trim().toLowerCase());
};

const ConfigSchema = z.object({
  apiKey: z.string().min(1),
  apiBase: z.string().url().default(DEFAULT_API_BASE),
  confirmWrites: z.boolean().default(false),
  timeoutMs: z.number().int().positive().default(DEFAULT_TIMEOUT_MS),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default(DEFAULT_LOG_LEVEL),
  consoleIdOverride: z.string().optional(),
  networkSiteIdOverride: z.string().optional(),
  siteManagerSiteIdOverride: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

function fieldError(field: string, msg: string): never {
  throw new Error(`Invalid config for ${field}: ${msg}`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.UNIFI_API_KEY?.trim();
  if (!apiKey) fieldError("UNIFI_API_KEY", "missing or empty");

  const timeoutRaw = env.UNIFI_TIMEOUT_MS?.trim();
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (timeoutRaw) {
    const n = Number(timeoutRaw);
    if (!Number.isFinite(n) || n <= 0)
      fieldError("UNIFI_TIMEOUT_MS", `expected positive number, got "${timeoutRaw}"`);
    timeoutMs = n;
  }

  const logLevel = (env.UNIFI_LOG_LEVEL ?? DEFAULT_LOG_LEVEL).trim();
  if (!["debug", "info", "warn", "error"].includes(logLevel))
    fieldError("UNIFI_LOG_LEVEL", `expected debug|info|warn|error, got "${logLevel}"`);

  const apiBase = env.UNIFI_API_BASE?.trim() || DEFAULT_API_BASE;

  return ConfigSchema.parse({
    apiKey,
    apiBase,
    confirmWrites: parseBool(env.UNIFI_CONFIRM_WRITES, false),
    timeoutMs,
    logLevel,
    consoleIdOverride: env.UNIFI_CONSOLE_ID?.trim() || undefined,
    networkSiteIdOverride: env.UNIFI_NETWORK_SITE_ID?.trim() || undefined,
    siteManagerSiteIdOverride: env.UNIFI_SITE_MANAGER_SITE_ID?.trim() || undefined,
  });
}
