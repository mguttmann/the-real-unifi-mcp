export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, ctx?: unknown): void;
  info(msg: string, ctx?: unknown): void;
  warn(msg: string, ctx?: unknown): void;
  error(msg: string, ctx?: unknown): void;
}

const SECRET_PATTERNS: { re: RegExp; replace: string }[] = [
  // Quoted JSON forms (kept from the original implementation).
  { re: /("?X-API-Key"?\s*[:=]\s*"?)([^\s",}&]+)/gi, replace: "$1***REDACTED***" },
  {
    re: /("?Authorization"?\s*[:=]\s*"?)(?:Bearer\s+)?([^\s",}&]+)/gi,
    replace: "$1***REDACTED***",
  },
  { re: /("?apiKey"?\s*[:=]\s*"?)([^\s",}&]+)/gi, replace: "$1***REDACTED***" },
  { re: /("?api_key"?\s*[:=]\s*"?)([^\s",}&]+)/gi, replace: "$1***REDACTED***" },
  // JSON string fields named like a password, WiFi passphrase, pre-shared key
  // or secret (audit N-22), plain and inside an escaped JSON string; the
  // whole quoted value is replaced, spaces included.
  {
    re: /("[\w-]*(?:password|passphrase|psk|secret|private[_-]?key|pre[_-]?shared[_-]?keys?)[\w-]*"\s*:\s*")((?:[^"\\]|\\.)*)(")/gi,
    replace: "$1***REDACTED***$3",
  },
  {
    re: /(\\"[\w-]*(?:password|passphrase|psk|secret|private[_-]?key|pre[_-]?shared[_-]?keys?)[\w-]*\\"\s*:\s*\\")(.*?)(\\")/gi,
    replace: "$1***REDACTED***$3",
  },
  // Env-assignment form: UNIFI_API_KEY=<value>
  { re: /(UNIFI_API_KEY\s*=\s*)([^\s"&]+)/gi, replace: "$1***REDACTED***" },
  // Secret carried in a URL query string: ?api_key=…&token=…&access_token=…
  {
    re: /([?&](?:api[_-]?key|apikey|token|access_token)=)([^\s&"]+)/gi,
    replace: "$1***REDACTED***",
  },
];

// Value-based scrub: the actual configured secret(s), redacted wherever they
// appear regardless of surrounding format (bare value, URL, unlabelled dump).
// Populated at startup via registerSecretValue(); empty until then.
const SECRET_VALUES = new Set<string>();

/**
 * Register a literal secret value (e.g. the live UNIFI_API_KEY) so it is
 * scrubbed from all log output by exact match, the last line of defence
 * behind the format-based patterns. Values shorter than 8 chars are ignored
 * to avoid over-redacting common substrings.
 */
export function registerSecretValue(value: string | undefined | null): void {
  if (typeof value === "string" && value.length >= 8) SECRET_VALUES.add(value);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactSecrets(input: string): string {
  let out = input;
  for (const { re, replace } of SECRET_PATTERNS) out = out.replace(re, replace);
  for (const value of SECRET_VALUES) {
    out = out.replace(new RegExp(escapeRegExp(value), "g"), "***REDACTED***");
  }
  return out;
}

/** The last-resort fatal line of src/index.ts, scrubbed like every log line (audit N-24). */
export function formatFatal(err: unknown): string {
  const text = err instanceof Error ? (err.stack ?? err.message) : String(err);
  return redactSecrets(`fatal: ${text}`) + "\n";
}

function format(level: LogLevel, msg: string, ctx?: unknown): string {
  const ts = new Date().toISOString();
  let line = `${ts} ${level} ${msg}`;
  if (ctx !== undefined) {
    let ctxStr: string;
    try {
      ctxStr = typeof ctx === "string" ? ctx : JSON.stringify(ctx);
    } catch {
      // Not serialisable (cycle, BigInt): fall back to the default string form.
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      ctxStr = String(ctx);
    }
    line += ` ${ctxStr}`;
  }
  return redactSecrets(line) + "\n";
}

export function createLogger(level: LogLevel = "info"): Logger {
  const threshold = LEVEL_RANK[level];
  const emit = (lvl: LogLevel, msg: string, ctx?: unknown) => {
    if (LEVEL_RANK[lvl] < threshold) return;
    process.stderr.write(format(lvl, msg, ctx));
  };
  return {
    debug: (m, c) => emit("debug", m, c),
    info: (m, c) => emit("info", m, c),
    warn: (m, c) => emit("warn", m, c),
    error: (m, c) => emit("error", m, c),
  };
}
