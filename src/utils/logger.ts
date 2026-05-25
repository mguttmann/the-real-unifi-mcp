export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, ctx?: unknown): void;
  info(msg: string, ctx?: unknown): void;
  warn(msg: string, ctx?: unknown): void;
  error(msg: string, ctx?: unknown): void;
}

const SECRET_PATTERNS: { re: RegExp; replace: string }[] = [
  { re: /(UNIFI_API_KEY\s*=\s*)([^\s"&]+)/gi, replace: "$1***REDACTED***" },
  { re: /("X-API-Key"\s*:\s*")([^"]+)(")/gi, replace: "$1***REDACTED***$3" },
  { re: /("Authorization"\s*:\s*")([^"]+)(")/gi, replace: "$1***REDACTED***$3" },
  { re: /("apiKey"\s*:\s*")([^"]+)(")/gi, replace: "$1***REDACTED***$3" },
  { re: /("api_key"\s*:\s*")([^"]+)(")/gi, replace: "$1***REDACTED***$3" },
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const { re, replace } of SECRET_PATTERNS) out = out.replace(re, replace);
  return out;
}

function format(level: LogLevel, msg: string, ctx?: unknown): string {
  const ts = new Date().toISOString();
  let line = `${ts} ${level} ${msg}`;
  if (ctx !== undefined) {
    let ctxStr: string;
    try {
      ctxStr = typeof ctx === "string" ? ctx : JSON.stringify(ctx);
    } catch {
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
