import { z } from "zod";
import { DEFAULT_API_BASE, DEFAULT_TIMEOUT_MS, DEFAULT_LOG_LEVEL } from "./constants.js";

const ON = new Set(["true", "1", "yes", "on"]);
const OFF = new Set(["false", "0", "no", "off"]);

/**
 * Fails closed (audit N-3): only an explicit off value turns the write
 * confirmation off. Unset, empty and on values keep it on; an unknown value
 * keeps it on and is reported through `warn`.
 */
function parseConfirmWrites(raw: string | undefined, warn: (msg: string) => void): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "" || ON.has(v)) return true;
  if (OFF.has(v)) return false;
  warn(
    `UNIFI_CONFIRM_WRITES=${JSON.stringify(raw)} is not one of true/1/yes/on or false/0/no/off; write confirmation stays on`,
  );
  return true;
}

/**
 * Opt-in switches of 0.3.0 (UNIFI_READ_ONLY, UNIFI_REDACT_SECRETS): unset,
 * empty and off values keep the 0.2.1 behaviour; an unknown value turns the
 * stricter behaviour on and is reported through `warn` (fail closed).
 */
function parseOptIn(name: string, raw: string | undefined, warn: (msg: string) => void): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "" || OFF.has(v)) return false;
  if (ON.has(v)) return true;
  warn(
    `${name}=${JSON.stringify(raw)} is not one of true/1/yes/on or false/0/no/off; treated as on`,
  );
  return true;
}

/**
 * Variables that `mcpb/manifest.json` fills from MCPB user settings as
 * `${user_config.<key>}` (held equal to the manifest by
 * tests/unit/mcpbPlaceholders.test.ts).
 */
export const MCPB_MAPPED_ENV: readonly string[] = [
  "UNIFI_API_KEY",
  "UNIFI_CONFIRM_WRITES",
  "UNIFI_LOG_LEVEL",
  "UNIFI_READ_ONLY",
  "UNIFI_REDACT_SECRETS",
];

const PLACEHOLDER = /^\$\{[^}]*\}$/;

/**
 * A host that does not substitute the MCPB placeholders passes the literal
 * `${user_config.<key>}`. Such a value counts as unset, so each switch keeps
 * its default (and a missing key still stops the server), with a warning;
 * it is not an unknown value that turns a switch on.
 */
function withoutPlaceholders(
  env: NodeJS.ProcessEnv,
  warn: (msg: string) => void,
): NodeJS.ProcessEnv {
  const out = { ...env };
  for (const name of MCPB_MAPPED_ENV) {
    const raw = out[name];
    if (raw !== undefined && PLACEHOLDER.test(raw.trim())) {
      warn(
        `${name} is the unsubstituted MCPB placeholder ${JSON.stringify(raw.trim())}; treated as unset`,
      );
      delete out[name];
    }
  }
  return out;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * UNIFI_API_BASE receives the API key (audit N-31): https only, plain http
 * only for a loopback host (local test stubs). Requests are sent to its
 * origin, so a path, query, fragment or credentials are refused instead of
 * being dropped silently.
 */
function parseApiBase(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    fieldError("UNIFI_API_BASE", `expected an https URL, got "${raw}"`);
  }
  const loopbackHttp = u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname);
  if (u.protocol !== "https:" && !loopbackHttp)
    fieldError(
      "UNIFI_API_BASE",
      `expected https (http only for 127.0.0.1, ::1 or localhost), got "${raw}"`,
    );
  if (u.username || u.password)
    fieldError("UNIFI_API_BASE", "credentials in the URL are not allowed");
  if (u.pathname !== "/" || u.search || u.hash)
    fieldError(
      "UNIFI_API_BASE",
      `expected an origin without path, query or fragment (for example https://api.ui.com), got "${raw}"`,
    );
  return raw;
}

const ConfigSchema = z.object({
  apiKey: z.string().min(1),
  apiBase: z.string().url().default(DEFAULT_API_BASE),
  confirmWrites: z.boolean().default(true),
  timeoutMs: z.number().int().positive().default(DEFAULT_TIMEOUT_MS),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default(DEFAULT_LOG_LEVEL),
  consoleIdOverride: z.string().optional(),
  networkSiteIdOverride: z.string().optional(),
  siteManagerSiteIdOverride: z.string().optional(),
  /** UNIFI_READ_ONLY (audit N-23): write tools refuse without a request. */
  readOnly: z.boolean().optional(),
  /** UNIFI_REDACT_SECRETS (audit N-22): secret fields masked in every tool result. */
  redactSecrets: z.boolean().optional(),
  /** UNIFI_MAX_RESULT_BYTES (audit N-32): longer tool results are cut; unset = no cap. */
  maxResultBytes: z.number().int().positive().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

function fieldError(field: string, msg: string): never {
  throw new Error(`Invalid config for ${field}: ${msg}`);
}

/**
 * Reads the configuration from the environment. Problems that keep a safe
 * value (an unknown UNIFI_CONFIRM_WRITES, an unsubstituted MCPB placeholder)
 * go to `warn`; the default writes
 * to stderr, because the logger does not exist yet.
 */
export function loadConfig(
  rawEnv: NodeJS.ProcessEnv = process.env,
  warn: (msg: string) => void = (msg) => process.stderr.write(`warn ${msg}\n`),
): Config {
  const env = withoutPlaceholders(rawEnv, warn);
  const apiKey = env.UNIFI_API_KEY?.trim();
  // Not "UNIFI_API_KEY: missing": the log scrubber treats "api_key: <word>" as
  // a secret and would hide the reason (audit N-89).
  if (!apiKey) throw new Error("Invalid config: UNIFI_API_KEY is missing or empty");

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

  const apiBase = parseApiBase(env.UNIFI_API_BASE?.trim() || DEFAULT_API_BASE);

  const maxRaw = env.UNIFI_MAX_RESULT_BYTES?.trim();
  let maxResultBytes: number | undefined;
  if (maxRaw) {
    if (!/^\d+$/.test(maxRaw) || Number(maxRaw) <= 0 || !Number.isSafeInteger(Number(maxRaw)))
      fieldError("UNIFI_MAX_RESULT_BYTES", `expected a positive integer, got "${maxRaw}"`);
    maxResultBytes = Number(maxRaw);
  }

  return ConfigSchema.parse({
    apiKey,
    apiBase,
    confirmWrites: parseConfirmWrites(env.UNIFI_CONFIRM_WRITES, warn),
    timeoutMs,
    logLevel,
    consoleIdOverride: env.UNIFI_CONSOLE_ID?.trim() || undefined,
    networkSiteIdOverride: env.UNIFI_NETWORK_SITE_ID?.trim() || undefined,
    siteManagerSiteIdOverride: env.UNIFI_SITE_MANAGER_SITE_ID?.trim() || undefined,
    readOnly: parseOptIn("UNIFI_READ_ONLY", env.UNIFI_READ_ONLY, warn),
    redactSecrets: parseOptIn("UNIFI_REDACT_SECRETS", env.UNIFI_REDACT_SECRETS, warn),
    maxResultBytes,
  });
}
