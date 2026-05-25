# UniFi MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lokaler stdio-MCP-Server, der die UniFi Site Manager + Network API zu 100 % als Tools, Resources und Prompts exponiert — lesend UND schreibend, cloud-only via `api.ui.com`.

**Architecture:** TypeScript ES-Module + `@modelcontextprotocol/sdk`. Dreischicht-Tool-Architektur: handgepflegte Site-Manager-Wrapper + handgepflegte Network-Wrapper für Komfort + automatisch generierte Tools aus der UniFi-RSC-Doku für 100 %-Abdeckung + ein generischer `unifi_raw_request` Escape-Hatch. Zentraler HTTP-Client mit Auth/Timeout/Retry, lazy-cached ID-Discovery, optionaler Schreibschutz-Preview via env-Schalter.

**Tech Stack:** Node ≥ 20, TypeScript 5.x, `@modelcontextprotocol/sdk` 1.x, `zod` 3.x, `vitest` 4.x, ESLint 9 (flat), Prettier 3, tsx (dev), MCPB.

**Spec:** `docs/superpowers/specs/2026-05-25-unifi-mcp-server-design.md`

---

## File Structure (übersicht)

| Ebene | Verantwortung |
|---|---|
| `src/index.ts` | stdio-Bootstrap: env laden, logger, server starten |
| `src/server.ts` | `buildServer()` — Tools/Resources/Prompts registrieren |
| `src/config.ts` | Zod-validierte env, `loadConfig()` |
| `src/constants.ts` | API-Basis, Header-Defaults, Retry-Defaults |
| `src/client/unifiClient.ts` | fetch-Wrapper mit Auth, Timeout, JSON-Parse |
| `src/client/retry.ts` | 429/5xx-Backoff inkl. `Retry-After`-Honor |
| `src/client/pagination.ts` | offset/limit + hasMore-Hint |
| `src/client/errors.ts` | `UnifiApiError` (statusCode/code/message) |
| `src/client/rsc.ts` | RSC-Doku-Fetcher (`RSC: 1`) |
| `src/client/discovery.ts` | consoleId + 2× siteId Cache |
| `src/tools/helpers.ts` | Auto-Resolve IDs, `jsonResult`/`errorResult` |
| `src/tools/destructiveGuard.ts` | Preview/Execute-Pattern |
| `src/tools/rawRequest.ts` | `unifi_raw_request` Escape-Hatch |
| `src/tools/siteManager.ts` | 10 Site-Manager-Hand-Wrapper |
| `src/tools/network/<resource>.ts` | Network-Hand-Wrapper je Resource |
| `src/tools/generated/index.ts` | Generierte Tools aggregiert |
| `src/codegen/{catalog,rscParser,schemaFromDoc,emit,generate}.ts` | Codegen-Pipeline |
| `src/resources/{identity,hosts}.ts` | `unifi://...` Resources |
| `src/prompts/{auditFirewall,networkHealth,adoptionStatus}.ts` | Prompt-Templates |
| `src/utils/{logger,json}.ts` | stdio-safe Logger, safe-stringify |
| `tests/unit/*` | mocked-fetch Unit-Tests |
| `tests/integration/*` | live read-only Smoke |
| `mcpb/manifest.json` + `scripts/build-mcpb.sh` | MCPB-Bundle |

---

## Task 1: Projekt-Scaffold (package.json, tsconfig, .gitignore, .env.example)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.gitignore`, `.env.example`, `README.md`, `CHANGELOG.md`, `LICENSE`

- [ ] **Step 1: package.json schreiben**

```json
{
  "name": "the-real-unifi-mcp",
  "version": "0.1.0",
  "description": "MCP server for the UniFi Site Manager + Network APIs — 100% coverage, hybrid hand-wrappers + codegen",
  "license": "MIT",
  "type": "module",
  "bin": { "the-real-unifi-mcp": "dist/index.js" },
  "main": "dist/index.js",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc",
    "build:mcpb": "bash scripts/build-mcpb.sh",
    "codegen": "tsx src/codegen/generate.ts",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "lint": "eslint src",
    "lint:fix": "eslint src --fix",
    "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\" \"tests/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:watch": "vitest",
    "inspector": "npx @modelcontextprotocol/inspector node dist/index.js",
    "prebuild": "npm run lint && npm run typecheck && npm run test:unit"
  },
  "engines": { "node": ">=20" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.20.0",
    "dotenv": "^16.4.5",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "@typescript-eslint/eslint-plugin": "^8.20.0",
    "@typescript-eslint/parser": "^8.20.0",
    "eslint": "^9.18.0",
    "globals": "^15.14.0",
    "prettier": "^3.4.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0",
    "vitest": "^4.1.6"
  }
}
```

- [ ] **Step 2: tsconfig.json schreiben**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: vitest.config.ts schreiben**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: { reporter: ["text", "html"], reportsDirectory: "coverage" },
  },
});
```

- [ ] **Step 4: eslint.config.js schreiben**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "src/tools/generated/**"] },
];
```

- [ ] **Step 5: .prettierrc.json schreiben**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 6: .gitignore schreiben**

```
.env
.env.local
node_modules/
dist/
coverage/
*.mcpb
.DS_Store
*.log
.remember/
```

- [ ] **Step 7: .env.example schreiben**

```
# Site Manager API key with Network scope. Required.
UNIFI_API_KEY=

# Optional overrides
UNIFI_API_BASE=https://api.ui.com
UNIFI_CONFIRM_WRITES=false
UNIFI_TIMEOUT_MS=30000
UNIFI_LOG_LEVEL=info

# Optional: skip discovery if you know the IDs
UNIFI_CONSOLE_ID=
UNIFI_NETWORK_SITE_ID=
UNIFI_SITE_MANAGER_SITE_ID=
```

- [ ] **Step 8: Minimal README.md schreiben**

```markdown
# the-real-unifi-mcp

MCP server for UniFi Site Manager + Network APIs. 100 % API coverage via hybrid hand-wrappers + codegen, stdio transport, cloud-only via `api.ui.com`.

## Setup

```bash
npm install
cp .env.example .env
# Set UNIFI_API_KEY in .env (Site Manager key with Network scope)
npm run build
```

## Run

```bash
npm start          # stdio
npm run inspector  # MCP Inspector
```

See spec at `docs/superpowers/specs/2026-05-25-unifi-mcp-server-design.md`.
```

- [ ] **Step 9: CHANGELOG.md anlegen**

```markdown
# Changelog

## [Unreleased]

### Added
- Initial scaffold
```

- [ ] **Step 10: LICENSE anlegen (MIT)**

```
MIT License

Copyright (c) 2026 Manuel Guttmann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

- [ ] **Step 11: `npm install` ausführen**

```bash
cd /Users/manuelguttmann/Projekte/the-real-unifi-mcp
npm install
```

Expected: erfolgreich, kein lock-conflict.

- [ ] **Step 12: Verifikation — tsc, eslint laufen ohne Code zu finden**

```bash
mkdir -p src
echo "export {};" > src/index.ts
npm run typecheck
npm run lint
```

Expected: Beide grün (oder leere `src/`-Warnung von ESLint, kein Fehler).

- [ ] **Step 13: Initial-Setup ist NICHT committed (kommt in finalem Task)** — Skipp Commit hier.

---

## Task 2: Logger (src/utils/logger.ts)

**Files:**
- Create: `src/utils/logger.ts`
- Test: `tests/unit/logger.test.ts`

Logger muss stdio-safe sein (nur stderr), Level-gefiltert und API-Keys redacten.

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/logger.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createLogger, redactSecrets } from "../../src/utils/logger.js";

describe("logger", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  it("writes info messages to stderr", () => {
    const log = createLogger("info");
    log.info("hello");
    expect(stderrSpy).toHaveBeenCalled();
    const out = String(stderrSpy.mock.calls[0]?.[0] ?? "");
    expect(out).toContain("hello");
    expect(out).toContain("info");
  });

  it("filters debug messages when level=info", () => {
    const log = createLogger("info");
    log.debug("noisy");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("redacts UNIFI_API_KEY=value patterns", () => {
    expect(redactSecrets("UNIFI_API_KEY=abc123def")).toBe("UNIFI_API_KEY=***REDACTED***");
  });

  it("redacts X-API-Key header values", () => {
    expect(redactSecrets('"X-API-Key": "vGQl99JC"')).toContain("***REDACTED***");
  });

  it("redacts apiKey JSON fields", () => {
    expect(redactSecrets('{"apiKey":"secret"}')).toContain("***REDACTED***");
  });

  it("does NOT write to stdout", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    createLogger("debug").info("anything");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/logger.test.ts
```

Expected: FAIL ("cannot find module …/logger.js").

- [ ] **Step 3: Logger implementieren**

```ts
// src/utils/logger.ts
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
```

- [ ] **Step 4: Tests laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/logger.test.ts
```

Expected: alle Tests grün.

---

## Task 3: Konstanten (src/constants.ts)

**Files:**
- Create: `src/constants.ts`

- [ ] **Step 1: Datei schreiben**

```ts
// src/constants.ts
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
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected: grün.

---

## Task 4: Config-Loader (src/config.ts)

**Files:**
- Create: `src/config.ts`
- Test: `tests/unit/config.test.ts`

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/config.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const SAVED = { ...process.env };
afterEach(() => {
  process.env = { ...SAVED };
});

describe("loadConfig", () => {
  beforeEach(() => {
    delete process.env.UNIFI_API_KEY;
    delete process.env.UNIFI_CONFIRM_WRITES;
    delete process.env.UNIFI_TIMEOUT_MS;
    delete process.env.UNIFI_API_BASE;
    delete process.env.UNIFI_LOG_LEVEL;
    delete process.env.UNIFI_CONSOLE_ID;
    delete process.env.UNIFI_NETWORK_SITE_ID;
    delete process.env.UNIFI_SITE_MANAGER_SITE_ID;
  });

  it("throws when UNIFI_API_KEY is missing", () => {
    expect(() => loadConfig()).toThrow(/UNIFI_API_KEY/);
  });

  it("loads minimal valid config", () => {
    process.env.UNIFI_API_KEY = "abc";
    const cfg = loadConfig();
    expect(cfg.apiKey).toBe("abc");
    expect(cfg.apiBase).toBe("https://api.ui.com");
    expect(cfg.confirmWrites).toBe(false);
    expect(cfg.timeoutMs).toBe(30_000);
    expect(cfg.logLevel).toBe("info");
  });

  it("parses confirmWrites flag with multiple truthy spellings", () => {
    process.env.UNIFI_API_KEY = "abc";
    for (const v of ["true", "1", "yes", "TRUE", " true "]) {
      process.env.UNIFI_CONFIRM_WRITES = v;
      expect(loadConfig().confirmWrites).toBe(true);
    }
    for (const v of ["false", "0", "no", ""]) {
      process.env.UNIFI_CONFIRM_WRITES = v;
      expect(loadConfig().confirmWrites).toBe(false);
    }
  });

  it("validates logLevel enum", () => {
    process.env.UNIFI_API_KEY = "abc";
    process.env.UNIFI_LOG_LEVEL = "garbage";
    expect(() => loadConfig()).toThrow(/UNIFI_LOG_LEVEL/);
  });

  it("validates timeoutMs is positive number", () => {
    process.env.UNIFI_API_KEY = "abc";
    process.env.UNIFI_TIMEOUT_MS = "-1";
    expect(() => loadConfig()).toThrow(/UNIFI_TIMEOUT_MS/);
  });

  it("propagates optional override IDs", () => {
    process.env.UNIFI_API_KEY = "abc";
    process.env.UNIFI_CONSOLE_ID = "C1";
    process.env.UNIFI_NETWORK_SITE_ID = "N1";
    process.env.UNIFI_SITE_MANAGER_SITE_ID = "S1";
    const cfg = loadConfig();
    expect(cfg.consoleIdOverride).toBe("C1");
    expect(cfg.networkSiteIdOverride).toBe("N1");
    expect(cfg.siteManagerSiteIdOverride).toBe("S1");
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/config.test.ts
```

- [ ] **Step 3: Config implementieren**

```ts
// src/config.ts
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
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/config.test.ts
```

Expected: alle 6 Tests grün.

---

## Task 5: Errors (src/client/errors.ts)

**Files:**
- Create: `src/client/errors.ts`
- Test: `tests/unit/errors.test.ts`

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/errors.test.ts
import { describe, expect, it } from "vitest";
import { UnifiApiError, parseApiError } from "../../src/client/errors.js";

describe("UnifiApiError", () => {
  it("captures status, statusName, code, message", () => {
    const e = new UnifiApiError({
      statusCode: 404,
      statusName: "NOT_FOUND",
      code: "api.request.error",
      message: "site not found",
    });
    expect(e.statusCode).toBe(404);
    expect(e.message).toContain("site not found");
    expect(e.code).toBe("api.request.error");
    expect(e instanceof Error).toBe(true);
  });
});

describe("parseApiError", () => {
  it("parses canonical UniFi error JSON", () => {
    const text = JSON.stringify({
      statusCode: 404,
      statusName: "NOT_FOUND",
      code: "api.request.error",
      message: "nope",
    });
    const e = parseApiError(text, 404);
    expect(e.statusCode).toBe(404);
    expect(e.message).toContain("nope");
  });

  it("falls back to generic message for non-JSON body", () => {
    const e = parseApiError("<html>500</html>", 500);
    expect(e.statusCode).toBe(500);
    expect(e.message).toContain("500");
  });

  it("falls back when JSON is valid but missing fields", () => {
    const e = parseApiError(JSON.stringify({ foo: "bar" }), 502);
    expect(e.statusCode).toBe(502);
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/errors.test.ts
```

- [ ] **Step 3: Errors implementieren**

```ts
// src/client/errors.ts
export interface UnifiErrorPayload {
  statusCode: number;
  statusName?: string;
  code?: string;
  message: string;
  details?: unknown;
}

export class UnifiApiError extends Error {
  readonly statusCode: number;
  readonly statusName: string | undefined;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(p: UnifiErrorPayload) {
    super(`[${p.statusCode}${p.statusName ? " " + p.statusName : ""}] ${p.message}`);
    this.name = "UnifiApiError";
    this.statusCode = p.statusCode;
    this.statusName = p.statusName;
    this.code = p.code;
    this.details = p.details;
  }
}

export function parseApiError(body: string, status: number): UnifiApiError {
  try {
    const parsed = JSON.parse(body) as Partial<UnifiErrorPayload>;
    if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
      return new UnifiApiError({
        statusCode: typeof parsed.statusCode === "number" ? parsed.statusCode : status,
        statusName: parsed.statusName,
        code: parsed.code,
        message: parsed.message,
        details: parsed.details,
      });
    }
  } catch {
    // fall through
  }
  return new UnifiApiError({
    statusCode: status,
    message: `HTTP ${status}${body ? `: ${body.slice(0, 200)}` : ""}`,
  });
}
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/errors.test.ts
```

---

## Task 6: Pagination Helpers (src/client/pagination.ts)

**Files:**
- Create: `src/client/pagination.ts`
- Test: `tests/unit/pagination.test.ts`

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/pagination.test.ts
import { describe, expect, it } from "vitest";
import { parsePaginationHint } from "../../src/client/pagination.js";

describe("parsePaginationHint", () => {
  it("detects more pages when offset+count < totalCount", () => {
    const hint = parsePaginationHint({ data: [1, 2, 3], offset: 0, limit: 3, count: 3, totalCount: 10 });
    expect(hint).toEqual({ hasMore: true, nextOffset: 3, totalCount: 10, returned: 3 });
  });

  it("returns null when totalCount is reached", () => {
    expect(parsePaginationHint({ data: [], offset: 9, limit: 1, count: 1, totalCount: 10 })).toBeNull();
  });

  it("returns null when envelope shape doesn't match", () => {
    expect(parsePaginationHint({ foo: "bar" })).toBeNull();
    expect(parsePaginationHint(null)).toBeNull();
    expect(parsePaginationHint([1, 2, 3])).toBeNull();
  });

  it("treats missing totalCount as no-more", () => {
    expect(parsePaginationHint({ data: [], offset: 0, limit: 10, count: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/pagination.test.ts
```

- [ ] **Step 3: Pagination implementieren**

```ts
// src/client/pagination.ts
export interface PaginationHint {
  hasMore: boolean;
  nextOffset: number;
  totalCount: number;
  returned: number;
}

interface PageEnvelope {
  data: unknown[];
  offset: number;
  limit: number;
  count: number;
  totalCount: number;
}

function isEnvelope(x: unknown): x is PageEnvelope {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>;
  return (
    Array.isArray(r.data) &&
    typeof r.offset === "number" &&
    typeof r.limit === "number" &&
    typeof r.count === "number" &&
    typeof r.totalCount === "number"
  );
}

export function parsePaginationHint(body: unknown): PaginationHint | null {
  if (!isEnvelope(body)) return null;
  const next = body.offset + body.count;
  if (next >= body.totalCount) return null;
  return { hasMore: true, nextOffset: next, totalCount: body.totalCount, returned: body.count };
}
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/pagination.test.ts
```

---

## Task 7: Retry-Logik (src/client/retry.ts)

**Files:**
- Create: `src/client/retry.ts`
- Test: `tests/unit/retry.test.ts`

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/retry.test.ts
import { describe, expect, it, vi } from "vitest";
import { withRetry, computeBackoff, parseRetryAfter } from "../../src/client/retry.js";
import { UnifiApiError } from "../../src/client/errors.js";

describe("computeBackoff", () => {
  it("returns the indexed delay from the schedule", () => {
    expect(computeBackoff(0)).toBe(1000);
    expect(computeBackoff(1)).toBe(2000);
    expect(computeBackoff(2)).toBe(4000);
  });
  it("clamps to last entry beyond the schedule", () => {
    expect(computeBackoff(99)).toBe(4000);
  });
});

describe("parseRetryAfter", () => {
  it("parses seconds form", () => {
    expect(parseRetryAfter("3")).toBe(3000);
  });
  it("parses HTTP-date form", () => {
    const inThreeSec = new Date(Date.now() + 3000).toUTCString();
    const ms = parseRetryAfter(inThreeSec);
    expect(ms).toBeGreaterThan(2000);
    expect(ms).toBeLessThan(4000);
  });
  it("returns null for garbage", () => {
    expect(parseRetryAfter("garbage")).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
  });
  it("clamps to 60s ceiling", () => {
    expect(parseRetryAfter("999")).toBe(60_000);
  });
});

describe("withRetry", () => {
  it("succeeds on first attempt without delay", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const out = await withRetry(fn, { maxAttempts: 3, sleep: vi.fn() });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 then succeeds", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new UnifiApiError({ statusCode: 429, message: "rate limited" });
      return "ok";
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const out = await withRetry(fn, { maxAttempts: 3, sleep });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry 4xx other than 429", async () => {
    const fn = vi.fn().mockRejectedValue(new UnifiApiError({ statusCode: 400, message: "bad" }));
    await expect(withRetry(fn, { maxAttempts: 3, sleep: vi.fn() })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx then gives up", async () => {
    const fn = vi.fn().mockRejectedValue(new UnifiApiError({ statusCode: 502, message: "bad gateway" }));
    await expect(withRetry(fn, { maxAttempts: 3, sleep: vi.fn() })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/retry.test.ts
```

- [ ] **Step 3: Retry implementieren**

```ts
// src/client/retry.ts
import { UnifiApiError } from "./errors.js";
import { RETRY } from "../constants.js";

export interface RetryOptions {
  maxAttempts: number;
  sleep?: (ms: number) => Promise<void>;
}

export function computeBackoff(attempt: number): number {
  const sched = RETRY.BACKOFF_MS;
  const idx = Math.min(attempt, sched.length - 1);
  return sched[idx]!;
}

export function parseRetryAfter(header: string | undefined | null): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    const ms = Number(trimmed) * 1000;
    return Math.min(ms, RETRY.RETRY_AFTER_CEILING_MS);
  }
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) {
    const ms = Math.max(0, date - Date.now());
    return Math.min(ms, RETRY.RETRY_AFTER_CEILING_MS);
  }
  return null;
}

const DEFAULT_SLEEP = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function isRetriable(err: unknown): boolean {
  if (err instanceof UnifiApiError) {
    if (err.statusCode === 429) return true;
    if (err.statusCode >= 500 && err.statusCode !== 501) return true;
    return false;
  }
  // Network errors expose `code` or generic message
  if (err instanceof Error) {
    return /ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(err.message);
  }
  return false;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? DEFAULT_SLEEP;
  let lastErr: unknown;
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === opts.maxAttempts - 1 || !isRetriable(err)) throw err;
      const retryAfter =
        err instanceof UnifiApiError && err.statusCode === 429
          ? // populated by the client with the response header
            (err.details as { retryAfterMs?: number } | undefined)?.retryAfterMs
          : undefined;
      const delay = retryAfter ?? computeBackoff(attempt);
      await sleep(delay);
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/retry.test.ts
```

- [ ] **Step 5: Commit-Block A (Foundation 1-7)**

```bash
git status --porcelain | grep "\.env$" && echo "ABORT — .env staged" && exit 1
git add package.json package-lock.json tsconfig.json vitest.config.ts eslint.config.js .prettierrc.json .gitignore .env.example README.md CHANGELOG.md LICENSE src/ tests/
git commit -m "feat: scaffold + foundation modules (logger, config, errors, pagination, retry)"
```

(Hinweis: Git ist erst in Task 34 initialisiert — bei Verwendung von subagent-driven-development wird das Commit-Verhalten am Ende konsolidiert. Falls Git bereits initialisiert: committen, sonst skip.)

---

## Task 8: RSC-Fetcher (src/client/rsc.ts)

**Files:**
- Create: `src/client/rsc.ts`
- Test: `tests/unit/rsc.test.ts`
- Test-Fixtures: `tests/fixtures/rsc/<page>.txt` (kommen in Task 23/24)

Der RSC-Fetcher holt eine Doku-Seite mit Header `RSC: 1`, dekodiert Unicode-Escapes und extrahiert das `"endpoint":{…}` JSON-Objekt.

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/rsc.test.ts
import { describe, expect, it, vi } from "vitest";
import { decodeUnicodeEscapes, extractEndpointJson, fetchEndpointSpec } from "../../src/client/rsc.js";

describe("decodeUnicodeEscapes", () => {
  it("decodes \\u escapes", () => {
    expect(decodeUnicodeEscapes('\\u0041BC')).toBe('ABC');
  });
  it("leaves non-escapes intact", () => {
    expect(decodeUnicodeEscapes("plain text")).toBe("plain text");
  });
});

describe("extractEndpointJson", () => {
  it("finds and parses a balanced endpoint block", () => {
    const text = 'noise "endpoint":{"path":"/v1/foo","method":"GET","parameters":[]} more';
    const ep = extractEndpointJson(text);
    expect(ep).toEqual({ path: "/v1/foo", method: "GET", parameters: [] });
  });

  it("handles nested braces in body schemas", () => {
    const text = '"endpoint":{"path":"/x","method":"POST","requestBody":{"schema":{"type":"object","properties":{"name":{"type":"string"}}}}}';
    const ep = extractEndpointJson(text);
    expect(ep?.requestBody?.schema?.type).toBe("object");
  });

  it("returns null when not found", () => {
    expect(extractEndpointJson("no endpoint here")).toBeNull();
  });
});

describe("fetchEndpointSpec", () => {
  it("calls developer.ui.com with RSC: 1 header and parses", async () => {
    const f = vi.fn().mockResolvedValue(new Response('"endpoint":{"path":"/v1/x","method":"GET"}', { status: 200 }));
    const ep = await fetchEndpointSpec("network/v10.3.58/getinfo", { fetch: f });
    expect(f).toHaveBeenCalledWith(
      "https://developer.ui.com/network/v10.3.58/getinfo",
      expect.objectContaining({ headers: expect.objectContaining({ RSC: "1" }) }),
    );
    expect(ep?.path).toBe("/v1/x");
  });

  it("throws when status is not 2xx", async () => {
    const f = vi.fn().mockResolvedValue(new Response("nope", { status: 404 }));
    await expect(fetchEndpointSpec("network/v10/x", { fetch: f })).rejects.toThrow(/404/);
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/rsc.test.ts
```

- [ ] **Step 3: RSC-Fetcher implementieren**

```ts
// src/client/rsc.ts
export interface DocParameter {
  name: string;
  in: "query" | "path" | "header";
  required?: boolean;
  schema?: unknown;
  description?: string;
}

export interface DocRequestBody {
  required?: boolean;
  schema?: unknown;
  description?: string;
}

export interface DocResponse {
  description?: string;
  schema?: unknown;
}

export interface EndpointSpec {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  parameters?: DocParameter[];
  requestBody?: DocRequestBody;
  responses?: Record<string, DocResponse>;
  summary?: string;
  description?: string;
  operationId?: string;
}

export function decodeUnicodeEscapes(s: string): string {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Find a balanced JSON object following `"endpoint":` in the RSC stream.
 * The RSC payload is JS-encoded text with literal `\u` escapes, so we
 * decode first, then walk braces to find the matching close.
 */
export function extractEndpointJson(rawText: string): EndpointSpec | null {
  const text = decodeUnicodeEscapes(rawText);
  const marker = '"endpoint":';
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf(marker, searchFrom);
    if (idx === -1) return null;
    const start = text.indexOf("{", idx + marker.length);
    if (start === -1) return null;
    // Walk balanced braces, respecting JSON strings.
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\" && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') inString = !inString;
      else if (!inString && ch === "{") depth++;
      else if (!inString && ch === "}") {
        depth--;
        if (depth === 0) {
          const slice = text.slice(start, i + 1);
          try {
            return JSON.parse(slice) as EndpointSpec;
          } catch {
            // try next marker occurrence
            searchFrom = i + 1;
            break;
          }
        }
      }
    }
    if (depth !== 0) searchFrom = start + 1;
  }
}

export interface FetchEndpointOptions {
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
}

export async function fetchEndpointSpec(
  docPath: string,
  opts: FetchEndpointOptions = {},
): Promise<EndpointSpec | null> {
  const base = opts.baseUrl ?? "https://developer.ui.com";
  const f = opts.fetch ?? globalThis.fetch;
  const url = `${base}/${docPath.replace(/^\/+/, "")}`;
  const res = await f(url, { headers: { RSC: "1", Accept: "text/x-component" } });
  if (!res.ok) throw new Error(`Doc fetch failed for ${url}: HTTP ${res.status}`);
  const text = await res.text();
  return extractEndpointJson(text);
}
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/rsc.test.ts
```

---

## Task 9: HTTP-Client (src/client/unifiClient.ts)

**Files:**
- Create: `src/client/unifiClient.ts`
- Test: `tests/unit/unifiClient.test.ts`

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/unifiClient.test.ts
import { describe, expect, it, vi } from "vitest";
import { UnifiClient } from "../../src/client/unifiClient.js";
import { UnifiApiError } from "../../src/client/errors.js";
import { createLogger } from "../../src/utils/logger.js";

const cfg = {
  apiKey: "k",
  apiBase: "https://api.ui.com",
  confirmWrites: false,
  timeoutMs: 1000,
  logLevel: "error" as const,
};

function mockFetch(impl: (req: { url: string; init: RequestInit }) => Promise<Response>) {
  return vi.fn().mockImplementation((url: string, init: RequestInit = {}) => impl({ url, init }));
}

describe("UnifiClient.request", () => {
  it("sends X-API-Key header on every call", async () => {
    const f = mockFetch(async () => new Response('{"data":[]}', { status: 200, headers: { "content-type": "application/json" } }));
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await c.request("GET", "/v1/hosts");
    expect(f).toHaveBeenCalledWith(
      "https://api.ui.com/v1/hosts",
      expect.objectContaining({ headers: expect.objectContaining({ "X-API-Key": "k" }) }),
    );
  });

  it("returns parsed JSON data with pagination hint when present", async () => {
    const body = { data: [1, 2], offset: 0, limit: 2, count: 2, totalCount: 10 };
    const f = mockFetch(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    const res = await c.request("GET", "/v1/x");
    expect(res.data).toEqual(body);
    expect(res.pagination?.hasMore).toBe(true);
    expect(res.pagination?.nextOffset).toBe(2);
  });

  it("serializes JSON body and sets Content-Type", async () => {
    let captured: RequestInit | undefined;
    const f = mockFetch(async ({ init }) => {
      captured = init;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await c.request("POST", "/v1/x", { body: { hello: "world" } });
    expect(captured?.body).toBe('{"hello":"world"}');
    expect((captured?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("appends query parameters", async () => {
    const f = mockFetch(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await c.request("GET", "/v1/x", { query: { offset: 5, limit: 10, filter: undefined } });
    const url = String(f.mock.calls[0]?.[0]);
    expect(url).toContain("offset=5");
    expect(url).toContain("limit=10");
    expect(url).not.toContain("filter=");
  });

  it("returns null for 204 No Content", async () => {
    const f = mockFetch(async () => new Response(null, { status: 204 }));
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    const res = await c.request("DELETE", "/v1/x");
    expect(res.data).toBeNull();
    expect(res.status).toBe(204);
  });

  it("throws UnifiApiError on 4xx", async () => {
    const body = JSON.stringify({ statusCode: 404, statusName: "NOT_FOUND", code: "x", message: "nope" });
    const f = mockFetch(async () => new Response(body, { status: 404, headers: { "content-type": "application/json" } }));
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await expect(c.request("GET", "/v1/x")).rejects.toBeInstanceOf(UnifiApiError);
  });

  it("attaches Retry-After to error.details on 429", async () => {
    const f = mockFetch(async () =>
      new Response(JSON.stringify({ statusCode: 429, message: "slow" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "2" },
      }),
    );
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });
    await expect(c.request("GET", "/v1/x", { retry: { maxAttempts: 1 } })).rejects.toMatchObject({
      statusCode: 429,
      details: expect.objectContaining({ retryAfterMs: 2000 }),
    });
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/unifiClient.test.ts
```

- [ ] **Step 3: Client implementieren**

```ts
// src/client/unifiClient.ts
import { UnifiApiError, parseApiError } from "./errors.js";
import { withRetry, parseRetryAfter } from "./retry.js";
import { parsePaginationHint, type PaginationHint } from "./pagination.js";
import type { Config } from "../config.js";
import type { Logger } from "../utils/logger.js";
import { NETWORK_PROXY_PREFIX } from "../constants.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  idempotent?: boolean;
  retry?: { maxAttempts?: number };
  signal?: AbortSignal;
}

export interface UnifiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  pagination?: PaginationHint;
}

export interface UnifiClientOptions {
  fetch?: typeof globalThis.fetch;
}

export class UnifiClient {
  constructor(
    private cfg: Config,
    private logger: Logger,
    private opts: UnifiClientOptions = {},
  ) {}

  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<UnifiResponse<T>> {
    const url = this.buildUrl(path, options.query);
    const maxAttempts = options.retry?.maxAttempts ?? this.defaultAttempts(method, options.idempotent);
    return withRetry(() => this.doRequest<T>(method, url, options), { maxAttempts });
  }

  async requestNetwork<T = unknown>(
    method: HttpMethod,
    consoleId: string,
    docPath: string,
    options: RequestOptions = {},
  ): Promise<UnifiResponse<T>> {
    const path = `/v1/connector/consoles/${encodeURIComponent(consoleId)}${NETWORK_PROXY_PREFIX}${docPath.startsWith("/") ? "" : "/"}${docPath}`;
    return this.request<T>(method, path, options);
  }

  private defaultAttempts(method: HttpMethod, idempotent?: boolean): number {
    if (method === "GET") return 3;
    if (idempotent) return 3;
    return 1; // POST without idempotent hint: no 5xx retry to avoid duplicates
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const u = new URL(path, this.cfg.apiBase);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }

  private async doRequest<T>(
    method: HttpMethod,
    url: string,
    options: RequestOptions,
  ): Promise<UnifiResponse<T>> {
    const headers: Record<string, string> = {
      "X-API-Key": this.cfg.apiKey,
      Accept: "application/json",
      ...(options.headers ?? {}),
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const f = this.opts.fetch ?? globalThis.fetch;
    const started = Date.now();
    let res: Response;
    try {
      res = await f(url, { method, headers, body, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new UnifiApiError({ statusCode: 0, message: `request to ${url} aborted (timeout ${this.cfg.timeoutMs}ms)` });
      }
      throw err;
    }
    clearTimeout(timer);

    this.logger.debug(`${method} ${url} → ${res.status} (${Date.now() - started}ms)`);

    if (res.status === 204) {
      return { data: null as T, status: res.status, headers: res.headers };
    }

    const text = await res.text();

    if (!res.ok) {
      const err = parseApiError(text, res.status);
      if (res.status === 429) {
        const retryAfterMs = parseRetryAfter(res.headers.get("retry-after")) ?? undefined;
        (err as unknown as { details: unknown }).details = { retryAfterMs };
      }
      throw err;
    }

    const ct = res.headers.get("content-type") ?? "";
    let parsed: unknown = null;
    if (ct.includes("application/json") && text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    } else {
      parsed = text;
    }

    const pagination = parsePaginationHint(parsed) ?? undefined;
    return { data: parsed as T, status: res.status, headers: res.headers, pagination };
  }
}
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/unifiClient.test.ts
```

---

## Task 10: Discovery (src/client/discovery.ts)

**Files:**
- Create: `src/client/discovery.ts`
- Test: `tests/unit/discovery.test.ts`

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/discovery.test.ts
import { describe, expect, it, vi } from "vitest";
import { Discovery } from "../../src/client/discovery.js";
import type { UnifiClient } from "../../src/client/unifiClient.js";

const ok = <T>(data: T) => ({ data, status: 200, headers: new Headers() });

function clientMock(): { client: UnifiClient; request: ReturnType<typeof vi.fn>; requestNetwork: ReturnType<typeof vi.fn> } {
  const request = vi.fn();
  const requestNetwork = vi.fn();
  const client = { request, requestNetwork } as unknown as UnifiClient;
  return { client, request, requestNetwork };
}

describe("Discovery", () => {
  it("resolves consoleId from /v1/hosts (type=console, owner=true)", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(ok({ data: [
      { id: "A", type: "console", owner: false },
      { id: "B", type: "console", owner: true },
    ]}));
    const d = new Discovery(client, {});
    expect(await d.consoleId()).toBe("B");
  });

  it("uses override when configured", async () => {
    const { client, request } = clientMock();
    const d = new Discovery(client, { consoleIdOverride: "PINNED" });
    expect(await d.consoleId()).toBe("PINNED");
    expect(request).not.toHaveBeenCalled();
  });

  it("caches consoleId across calls", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValue(ok({ data: [{ id: "X", type: "console", owner: true }] }));
    const d = new Discovery(client, {});
    await d.consoleId();
    await d.consoleId();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("throws on zero matching consoles", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(ok({ data: [] }));
    const d = new Discovery(client, {});
    await expect(d.consoleId()).rejects.toThrow(/no.*console/i);
  });

  it("throws on multiple matching consoles without override", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(ok({ data: [
      { id: "A", type: "console", owner: true },
      { id: "B", type: "console", owner: true },
    ]}));
    const d = new Discovery(client, {});
    await expect(d.consoleId()).rejects.toThrow(/multiple.*UNIFI_CONSOLE_ID/i);
  });

  it("resolves networkSiteId via requestNetwork", async () => {
    const { client, request, requestNetwork } = clientMock();
    request.mockResolvedValue(ok({ data: [{ id: "C", type: "console", owner: true }] }));
    requestNetwork.mockResolvedValueOnce(ok({ data: [{ id: "SITE-N", name: "Default" }] }));
    const d = new Discovery(client, {});
    expect(await d.networkSiteId()).toBe("SITE-N");
  });

  it("resolves siteManagerSiteId from /v1/sites", async () => {
    const { client, request } = clientMock();
    request.mockResolvedValueOnce(ok({ data: [{ siteId: "SM1" }] }));
    const d = new Discovery(client, {});
    expect(await d.siteManagerSiteId()).toBe("SM1");
  });

  it("deduplicates concurrent calls", async () => {
    const { client, request } = clientMock();
    let resolveFn!: (v: unknown) => void;
    request.mockReturnValueOnce(new Promise((r) => { resolveFn = r; }));
    const d = new Discovery(client, {});
    const a = d.consoleId();
    const b = d.consoleId();
    resolveFn(ok({ data: [{ id: "Z", type: "console", owner: true }] }));
    expect(await a).toBe("Z");
    expect(await b).toBe("Z");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/discovery.test.ts
```

- [ ] **Step 3: Discovery implementieren**

```ts
// src/client/discovery.ts
import type { UnifiClient } from "./unifiClient.js";

interface DiscoveryDeps {
  consoleIdOverride?: string;
  networkSiteIdOverride?: string;
  siteManagerSiteIdOverride?: string;
}

interface Host {
  id: string;
  type?: string;
  owner?: boolean;
  reportedState?: { hostname?: string; ip?: string };
  hardwareId?: string;
}

export interface UnifiIdentity {
  consoleId: string;
  networkSiteId: string;
  siteManagerSiteId: string;
  console?: Host;
}

export class Discovery {
  private consoleIdP?: Promise<string>;
  private networkSiteIdP?: Promise<string>;
  private siteManagerSiteIdP?: Promise<string>;

  constructor(private client: UnifiClient, private cfg: DiscoveryDeps) {}

  async consoleId(): Promise<string> {
    if (this.cfg.consoleIdOverride) return this.cfg.consoleIdOverride;
    if (!this.consoleIdP) {
      this.consoleIdP = this.resolveConsoleId().catch((e) => {
        this.consoleIdP = undefined;
        throw e;
      });
    }
    return this.consoleIdP;
  }

  async networkSiteId(): Promise<string> {
    if (this.cfg.networkSiteIdOverride) return this.cfg.networkSiteIdOverride;
    if (!this.networkSiteIdP) {
      this.networkSiteIdP = this.resolveNetworkSiteId().catch((e) => {
        this.networkSiteIdP = undefined;
        throw e;
      });
    }
    return this.networkSiteIdP;
  }

  async siteManagerSiteId(): Promise<string> {
    if (this.cfg.siteManagerSiteIdOverride) return this.cfg.siteManagerSiteIdOverride;
    if (!this.siteManagerSiteIdP) {
      this.siteManagerSiteIdP = this.resolveSiteManagerSiteId().catch((e) => {
        this.siteManagerSiteIdP = undefined;
        throw e;
      });
    }
    return this.siteManagerSiteIdP;
  }

  async identity(): Promise<UnifiIdentity> {
    const [c, n, s] = await Promise.all([this.consoleId(), this.networkSiteId(), this.siteManagerSiteId()]);
    // load host detail (best effort)
    let console: Host | undefined;
    try {
      const res = await this.client.request<{ data?: Host }>("GET", `/v1/hosts/${encodeURIComponent(c)}`);
      console = (res.data as { data?: Host })?.data ?? (res.data as Host);
    } catch {
      // ignore
    }
    return { consoleId: c, networkSiteId: n, siteManagerSiteId: s, console };
  }

  reset(): void {
    this.consoleIdP = undefined;
    this.networkSiteIdP = undefined;
    this.siteManagerSiteIdP = undefined;
  }

  private async resolveConsoleId(): Promise<string> {
    const res = await this.client.request<{ data: Host[] }>("GET", "/v1/hosts");
    const hosts = res.data?.data ?? [];
    const matches = hosts.filter((h) => h.type === "console" && h.owner === true);
    if (matches.length === 0) {
      throw new Error("Discovery: no console found (need type=console, owner=true). Check API key scope.");
    }
    if (matches.length > 1) {
      const ids = matches.map((m) => m.id).join(", ");
      throw new Error(`Discovery: multiple consoles match (${ids}). Set UNIFI_CONSOLE_ID env var to pin one.`);
    }
    return matches[0]!.id;
  }

  private async resolveNetworkSiteId(): Promise<string> {
    const c = await this.consoleId();
    const res = await this.client.requestNetwork<{ data: { id: string }[] }>(
      "GET",
      c,
      "/v1/sites",
    );
    const sites = res.data?.data ?? [];
    if (sites.length === 0) throw new Error("Discovery: Network API returned zero sites.");
    if (sites.length > 1) {
      const ids = sites.map((s) => s.id).join(", ");
      // Use first one but log: many UDM Pros have only one
      // — if multiple appear, user should set UNIFI_NETWORK_SITE_ID
      throw new Error(`Discovery: multiple Network sites (${ids}). Set UNIFI_NETWORK_SITE_ID env var.`);
    }
    return sites[0]!.id;
  }

  private async resolveSiteManagerSiteId(): Promise<string> {
    const res = await this.client.request<{ data: { siteId: string }[] }>("GET", "/v1/sites");
    const sites = res.data?.data ?? [];
    if (sites.length === 0) throw new Error("Discovery: Site Manager returned zero sites.");
    return sites[0]!.siteId;
  }
}
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/discovery.test.ts
```

---

## Task 11: Tool-Result-Helpers (src/tools/helpers.ts)

**Files:**
- Create: `src/tools/helpers.ts`
- Test: `tests/unit/toolHelpers.test.ts`

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/toolHelpers.test.ts
import { describe, expect, it } from "vitest";
import { errorResult, jsonResult, redactBody } from "../../src/tools/helpers.js";

describe("jsonResult", () => {
  it("wraps data in MCP content text", () => {
    const r = jsonResult({ a: 1 });
    expect(r.content[0]).toMatchObject({ type: "text" });
    expect(JSON.parse((r.content[0] as { text: string }).text)).toEqual({ a: 1 });
    expect(r.isError).toBeUndefined();
  });

  it("attaches pagination note when present", () => {
    const r = jsonResult({ items: [1, 2] }, { pagination: { hasMore: true, nextOffset: 50, totalCount: 200, returned: 50 } });
    const text = (r.content[0] as { text: string }).text;
    expect(text).toContain("nextOffset");
    expect(text).toContain("200");
  });
});

describe("errorResult", () => {
  it("marks isError true and returns the message", () => {
    const r = errorResult("boom");
    expect(r.isError).toBe(true);
    expect((r.content[0] as { text: string }).text).toContain("boom");
  });
});

describe("redactBody", () => {
  it("redacts password/key/secret/token keys recursively", () => {
    const r = redactBody({ user: "u", password: "p", nested: { apiKey: "k", token: "t", ok: "ok" } });
    expect(r).toEqual({ user: "u", password: "(redacted)", nested: { apiKey: "(redacted)", token: "(redacted)", ok: "ok" } });
  });
  it("handles arrays", () => {
    expect(redactBody([{ secret: "s" }, { ok: "o" }])).toEqual([{ secret: "(redacted)" }, { ok: "o" }]);
  });
  it("returns primitives unchanged", () => {
    expect(redactBody("plain")).toBe("plain");
    expect(redactBody(42)).toBe(42);
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/toolHelpers.test.ts
```

- [ ] **Step 3: helpers implementieren**

```ts
// src/tools/helpers.ts
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
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/toolHelpers.test.ts
```

---

## Task 12: destructiveGuard (src/tools/destructiveGuard.ts)

**Files:**
- Create: `src/tools/destructiveGuard.ts`
- Test: `tests/unit/destructiveGuard.test.ts`

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/destructiveGuard.test.ts
import { describe, expect, it, vi } from "vitest";
import { runGuarded } from "../../src/tools/destructiveGuard.js";

const cfgOff = { confirmWrites: false } as { confirmWrites: boolean };
const cfgOn = { confirmWrites: true } as { confirmWrites: boolean };

describe("runGuarded", () => {
  it("executes directly when confirmWrites=false", async () => {
    const fn = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    const res = await runGuarded(cfgOff, {}, { method: "POST", url: "/x" }, fn);
    expect(fn).toHaveBeenCalled();
    expect((res.content[0] as { text: string }).text).toBe("ok");
  });

  it("returns preview when confirmWrites=true and no confirm arg", async () => {
    const fn = vi.fn();
    const res = await runGuarded(cfgOn, {}, { method: "POST", url: "/x", body: { foo: 1 } }, fn);
    expect(fn).not.toHaveBeenCalled();
    expect(res.isError).toBeUndefined();
    const text = (res.content[0] as { text: string }).text;
    expect(text).toContain("preview");
    expect(text).toContain("POST");
  });

  it("executes when confirmWrites=true and confirm=YES", async () => {
    const fn = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    await runGuarded(cfgOn, { confirm: "YES" }, { method: "POST", url: "/x" }, fn);
    expect(fn).toHaveBeenCalled();
  });

  it("redacts sensitive fields in preview body", async () => {
    const res = await runGuarded(
      cfgOn,
      {},
      { method: "POST", url: "/x", body: { name: "n", password: "p" } },
      vi.fn(),
    );
    const text = (res.content[0] as { text: string }).text;
    expect(text).not.toContain('"p"');
    expect(text).toContain("(redacted)");
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/destructiveGuard.test.ts
```

- [ ] **Step 3: Guard implementieren**

```ts
// src/tools/destructiveGuard.ts
import { z } from "zod";
import { jsonResult, redactBody } from "./helpers.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../config.js";

export const confirmShape = {
  confirm: z
    .literal("YES")
    .optional()
    .describe('Required when UNIFI_CONFIRM_WRITES=true. Exact string "YES".'),
};

export interface WriteRequestDescription {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  toolName?: string;
}

export async function runGuarded(
  cfg: Pick<Config, "confirmWrites">,
  args: { confirm?: "YES" },
  req: WriteRequestDescription,
  execute: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  if (!cfg.confirmWrites) return execute();
  if (args.confirm === "YES") return execute();
  return jsonResult({
    preview: {
      tool: req.toolName,
      method: req.method,
      url: req.url,
      body: req.body !== undefined ? redactBody(req.body) : undefined,
    },
    hint: 'UNIFI_CONFIRM_WRITES=true is set. Re-run with `confirm: "YES"` to apply this change.',
  });
}
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/destructiveGuard.test.ts
```

---

## Task 13: Server-Skelett + Bootstrap (src/server.ts + src/index.ts)

**Files:**
- Create: `src/server.ts`, `src/index.ts`

- [ ] **Step 1: src/server.ts schreiben (vorerst nur registriert leere tool-Listen)**

```ts
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UnifiClient } from "./client/unifiClient.js";
import { Discovery } from "./client/discovery.js";
import { loadConfig, type Config } from "./config.js";
import { createLogger, type Logger } from "./utils/logger.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";

export interface ServerContext {
  cfg: Config;
  logger: Logger;
  client: UnifiClient;
  discovery: Discovery;
}

export function buildServer(overrideCfg?: Config): { server: McpServer; ctx: ServerContext } {
  const cfg = overrideCfg ?? loadConfig();
  const logger = createLogger(cfg.logLevel);
  const client = new UnifiClient(cfg, logger);
  const discovery = new Discovery(client, {
    consoleIdOverride: cfg.consoleIdOverride,
    networkSiteIdOverride: cfg.networkSiteIdOverride,
    siteManagerSiteIdOverride: cfg.siteManagerSiteIdOverride,
  });
  const ctx: ServerContext = { cfg, logger, client, discovery };

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions: [
        "## UniFi MCP",
        "Cloud-only access to UniFi Site Manager + Network APIs via api.ui.com.",
        "Three tool layers (all callable):",
        "- `unifi_sm_*` — Site Manager hand-wrappers (account-level: hosts, sites, devices, ISP metrics, SD-WAN).",
        "- `unifi_net_*` — Network hand-wrappers (per-console: devices, clients, networks, WLANs, firewall, ACL, DNS, hotspot).",
        "- `unifi_gen_*` — auto-generated tools (100% API coverage; use when no hand-wrapper exists).",
        "- `unifi_raw_request` — escape hatch for any path/method.",
        "## Write safety",
        "- Tools that modify state are marked `destructiveHint: true`.",
        "- If `UNIFI_CONFIRM_WRITES=true` is set, destructive tools return a preview unless called with `confirm: \"YES\"`.",
        "## IDs",
        "- consoleId, network siteId, site-manager siteId are auto-resolved on first use. Browse `unifi://identity` to see them.",
        "- Override via UNIFI_CONSOLE_ID / UNIFI_NETWORK_SITE_ID / UNIFI_SITE_MANAGER_SITE_ID env vars.",
      ].join("\n"),
    },
  );

  // Tool registrations follow in later tasks
  return { server, ctx };
}
```

- [ ] **Step 2: src/index.ts schreiben**

```ts
// src/index.ts
#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const { server, ctx } = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  ctx.logger.info("UniFi MCP server connected (stdio)");
}

main().catch((err) => {
  // last-resort: write to stderr; never stdout (would corrupt JSON-RPC)
  process.stderr.write(`fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
```

- [ ] **Step 3: Build prüfen**

```bash
npm run typecheck
npm run build
```

Expected: dist/index.js existiert.

- [ ] **Step 4: Smoke-Run (Server startet, beendet schnell mangels Input)**

```bash
echo '' | UNIFI_API_KEY=dummy timeout 2 node dist/index.js || true
```

Expected: kein Crash beim Start (process exit nach 2s ist OK).

---

## Task 14: unifi_raw_request — Escape-Hatch (src/tools/rawRequest.ts)

**Files:**
- Create: `src/tools/rawRequest.ts`
- Test: `tests/unit/rawRequest.test.ts`
- Modify: `src/server.ts` (Tool registrieren)

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/rawRequest.test.ts
import { describe, expect, it, vi } from "vitest";
import { registerRawRequestTool } from "../../src/tools/rawRequest.js";
import type { ServerContext } from "../../src/server.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function ctxMock(extra?: Partial<ServerContext>): ServerContext {
  return {
    cfg: { confirmWrites: false, apiKey: "", apiBase: "https://api.ui.com", logLevel: "error", timeoutMs: 1000 } as ServerContext["cfg"],
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    client: { request: vi.fn() } as unknown as ServerContext["client"],
    discovery: {} as ServerContext["discovery"],
    ...extra,
  } as ServerContext;
}

describe("unifi_raw_request", () => {
  it("registers a tool named unifi_raw_request", () => {
    const tools: Record<string, unknown> = {};
    const server = { registerTool: (name: string, def: unknown) => { tools[name] = def; } } as unknown as McpServer;
    registerRawRequestTool(server, ctxMock());
    expect(tools["unifi_raw_request"]).toBeDefined();
  });

  it("passes method/path/body to client.request", async () => {
    const reqFn = vi.fn().mockResolvedValue({ data: { ok: true }, status: 200, headers: new Headers() });
    const ctx = ctxMock({ client: { request: reqFn } as unknown as ServerContext["client"] });
    let handler!: (args: Record<string, unknown>) => Promise<unknown>;
    const server = { registerTool: (_n: string, def: { handler: typeof handler }) => { handler = def.handler; } } as unknown as McpServer;
    registerRawRequestTool(server, ctx);
    await handler({ method: "POST", path: "/v1/x", body: { a: 1 } });
    expect(reqFn).toHaveBeenCalledWith("POST", "/v1/x", expect.objectContaining({ body: { a: 1 } }));
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/rawRequest.test.ts
```

- [ ] **Step 3: rawRequest implementieren**

```ts
// src/tools/rawRequest.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.js";
import { jsonResult, errorResult } from "./helpers.js";
import { runGuarded, confirmShape } from "./destructiveGuard.js";
import { UnifiApiError } from "../client/errors.js";

const methodEnum = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const inputShape = {
  method: methodEnum.describe("HTTP method"),
  path: z.string().describe('Path beginning with "/v1/…" against api.ui.com. Example: "/v1/hosts".'),
  body: z.unknown().optional().describe("JSON body for POST/PUT/PATCH"),
  query: z.record(z.string()).optional().describe("Query parameters as flat string map"),
  ...confirmShape,
};

export function registerRawRequestTool(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_raw_request",
    {
      title: "UniFi raw request",
      description:
        "Generic escape hatch — executes ANY HTTP method against api.ui.com{path}. Use when no dedicated tool exists. Auth, retry, error parsing and pagination hints are handled automatically.",
      inputSchema: inputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const method = args.method;
      const performExecute = async () => {
        try {
          const res = await ctx.client.request(method, args.path, {
            body: args.body,
            query: args.query,
          });
          return jsonResult(res.data, { pagination: res.pagination });
        } catch (err) {
          if (err instanceof UnifiApiError) {
            return errorResult(err.message, { statusCode: err.statusCode, code: err.code });
          }
          throw err;
        }
      };
      if (method === "GET") return performExecute();
      return runGuarded(
        ctx.cfg,
        args,
        { toolName: "unifi_raw_request", method: method as "POST" | "PUT" | "PATCH" | "DELETE", url: args.path, body: args.body },
        performExecute,
      );
    },
  );
}
```

- [ ] **Step 4: Server-Datei erweitern, Tool registrieren**

In `src/server.ts` nach Erstellung des `server`-Objekts und vor `return`:

```ts
import { registerRawRequestTool } from "./tools/rawRequest.js";
// ...
registerRawRequestTool(server, ctx);
```

- [ ] **Step 5: Tests + Build laufen**

```bash
npm run test:unit
npm run build
```

Expected: alles grün.

---

## Task 15: Site-Manager Hand-Wrapper (src/tools/siteManager.ts)

**Files:**
- Create: `src/tools/siteManager.ts`
- Test: `tests/unit/siteManager.test.ts`
- Modify: `src/server.ts`

10 hand-gepflegte Tools für die Site-Manager-API (Brief §4.1).

- [ ] **Step 1: Test-Datei für Registrierung schreiben (smoke)**

```ts
// tests/unit/siteManager.test.ts
import { describe, expect, it, vi } from "vitest";
import { registerSiteManagerTools } from "../../src/tools/siteManager.js";
import type { ServerContext } from "../../src/server.js";

describe("siteManager tools", () => {
  it("registers all 10 expected tool names", () => {
    const tools: string[] = [];
    const server = { registerTool: (name: string) => { tools.push(name); } } as unknown as Parameters<typeof registerSiteManagerTools>[0];
    const ctx = {
      cfg: { confirmWrites: false } as ServerContext["cfg"],
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      client: { request: vi.fn() } as unknown as ServerContext["client"],
      discovery: {} as ServerContext["discovery"],
    } as ServerContext;
    registerSiteManagerTools(server, ctx);
    expect(tools).toEqual(
      expect.arrayContaining([
        "unifi_sm_list_hosts",
        "unifi_sm_get_host",
        "unifi_sm_list_sites",
        "unifi_sm_list_devices",
        "unifi_sm_get_isp_metrics",
        "unifi_sm_query_isp_metrics",
        "unifi_sm_list_sdwan_configs",
        "unifi_sm_get_sdwan_config",
        "unifi_sm_get_sdwan_config_status",
        "unifi_sm_identity",
      ]),
    );
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/siteManager.test.ts
```

- [ ] **Step 3: siteManager.ts implementieren — Pattern + alle 10 Tools**

```ts
// src/tools/siteManager.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.js";
import { errorResult, jsonResult } from "./helpers.js";
import { UnifiApiError } from "../client/errors.js";

function readOnly() {
  return { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
}

function writeHint() {
  return { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
}

async function getJson(ctx: ServerContext, method: "GET" | "POST", path: string, opts?: { body?: unknown; query?: Record<string, string | number | undefined> }) {
  try {
    const res = await ctx.client.request(method, path, opts ?? {});
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode, code: err.code });
    throw err;
  }
}

export function registerSiteManagerTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_sm_list_hosts",
    { title: "List hosts", description: "Account-level: list all UniFi consoles linked to this Site Manager account.", inputSchema: {}, annotations: readOnly() },
    async () => getJson(ctx, "GET", "/v1/hosts"),
  );

  server.registerTool(
    "unifi_sm_get_host",
    {
      title: "Get host detail",
      description: "Account-level: detail for a single host (console).",
      inputSchema: { id: z.string().describe("Host id (consoleId from list_hosts)") },
      annotations: readOnly(),
    },
    async (a) => getJson(ctx, "GET", `/v1/hosts/${encodeURIComponent(a.id)}`),
  );

  server.registerTool(
    "unifi_sm_list_sites",
    { title: "List Site Manager sites", description: "Account-level sites.", inputSchema: {}, annotations: readOnly() },
    async () => getJson(ctx, "GET", "/v1/sites"),
  );

  server.registerTool(
    "unifi_sm_list_devices",
    { title: "List devices (account)", description: "Account-level devices view (not the deep Network-API per-site list).", inputSchema: {}, annotations: readOnly() },
    async () => getJson(ctx, "GET", "/v1/devices"),
  );

  server.registerTool(
    "unifi_sm_get_isp_metrics",
    {
      title: "Get ISP metrics",
      description: "ISP metrics for a granularity bucket.",
      inputSchema: {
        type: z.enum(["5m", "1h"]).describe("Granularity"),
        beginTimestamp: z.string().optional().describe("ISO timestamp (begin)"),
        endTimestamp: z.string().optional().describe("ISO timestamp (end)"),
      },
      annotations: readOnly(),
    },
    async (a) =>
      getJson(ctx, "GET", `/v1/isp-metrics/${a.type}`, {
        query: { beginTimestamp: a.beginTimestamp, endTimestamp: a.endTimestamp },
      }),
  );

  server.registerTool(
    "unifi_sm_query_isp_metrics",
    {
      title: "Query ISP metrics",
      description: "POST a time-window query for ISP metrics.",
      inputSchema: {
        type: z.enum(["5m", "1h"]),
        body: z.unknown().describe("Query body — see UniFi Site Manager docs for shape."),
      },
      annotations: readOnly(),
    },
    async (a) => getJson(ctx, "POST", `/v1/isp-metrics/${a.type}/query`, { body: a.body }),
  );

  server.registerTool(
    "unifi_sm_list_sdwan_configs",
    { title: "List SD-WAN configurations", description: "Account-level SD-WAN configurations.", inputSchema: {}, annotations: readOnly() },
    async () => getJson(ctx, "GET", "/v1/sd-wan-configs"),
  );

  server.registerTool(
    "unifi_sm_get_sdwan_config",
    {
      title: "Get SD-WAN configuration",
      description: "Get a single SD-WAN configuration.",
      inputSchema: { id: z.string().describe("SD-WAN config id") },
      annotations: readOnly(),
    },
    async (a) => getJson(ctx, "GET", `/v1/sd-wan-configs/${encodeURIComponent(a.id)}`),
  );

  server.registerTool(
    "unifi_sm_get_sdwan_config_status",
    {
      title: "Get SD-WAN configuration status",
      description: "Status of a SD-WAN configuration.",
      inputSchema: { id: z.string() },
      annotations: readOnly(),
    },
    async (a) => getJson(ctx, "GET", `/v1/sd-wan-configs/${encodeURIComponent(a.id)}/status`),
  );

  server.registerTool(
    "unifi_sm_identity",
    {
      title: "Resolved identity",
      description: "Returns consoleId, networkSiteId, siteManagerSiteId — useful for sanity checks.",
      inputSchema: {},
      annotations: readOnly(),
    },
    async () => {
      try {
        const id = await ctx.discovery.identity();
        return jsonResult(id);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
```

- [ ] **Step 4: In `src/server.ts` registrieren**

In `buildServer()` ergänzen (Imports oben, Call vor `return`):

```ts
import { registerSiteManagerTools } from "./tools/siteManager.js";
// ...
registerSiteManagerTools(server, ctx);
```

- [ ] **Step 5: Tests + Build**

```bash
npm run test:unit
npm run build
```

Expected: alles grün.

---

## Pattern für alle Network-Hand-Wrapper

Jeder Network-Hand-Wrapper folgt diesem Schema. Wird in den Folge-Tasks referenziert.

```ts
// Pattern: src/tools/network/<resource>.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { errorResult, jsonResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

async function callNetwork(
  ctx: ServerContext,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  pathBuilder: (siteId: string) => string,
  opts?: { body?: unknown; query?: Record<string, string | number | undefined> },
) {
  try {
    const [consoleId, siteId] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const docPath = pathBuilder(siteId);
    const res = await ctx.client.requestNetwork(method, consoleId, docPath, opts ?? {});
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode, code: err.code });
    throw err;
  }
}

async function callNetworkGuarded(
  ctx: ServerContext,
  args: { confirm?: "YES" },
  toolName: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  pathBuilder: (siteId: string) => string,
  body?: unknown,
) {
  const [consoleId, siteId] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
  const docPath = pathBuilder(siteId);
  const url = `/v1/connector/consoles/${consoleId}/proxy/network/integration${docPath}`;
  return runGuarded(ctx.cfg, args, { toolName, method, url, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, consoleId, docPath, { body });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode, code: err.code });
      throw err;
    }
  });
}

const paginationShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional().describe("Network API filter expression"),
};

function paginationQuery(a: { offset?: number; limit?: number; filter?: string }) {
  return { offset: a.offset, limit: a.limit, filter: a.filter };
}
```

In jedem `network/<resource>.ts` wird ein `registerXxxTools(server, ctx)`-Export bereitgestellt, der via `server.registerTool(name, def, handler)` arbeitet. Subsequent Tasks listen pro Resource die zu erzeugenden Tools mit Name → Methode → Pfad → Schema-Kurzfassung.

---

## Task 16: Network — Info, Sites, Devices (+ Aktions-Wrapper)

**Files:**
- Create: `src/tools/network/info.ts`, `src/tools/network/sites.ts`, `src/tools/network/devices.ts`
- Test: `tests/unit/network.devices.test.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: info.ts und sites.ts schreiben**

```ts
// src/tools/network/info.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

export function registerInfoTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_get_info",
    {
      title: "Network application info",
      description: "Reads /v1/info on the Network application via the Cloud Connector. Useful as a health probe.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => {
      try {
        const cid = await ctx.discovery.consoleId();
        const res = await ctx.client.requestNetwork("GET", cid, "/v1/info");
        return jsonResult(res.data);
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
```

```ts
// src/tools/network/sites.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

export function registerSitesTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_sites",
    {
      title: "List Network sites",
      description: "Lists the local sites that the Network application exposes (NOT the same as Site Manager sites).",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => {
      try {
        const cid = await ctx.discovery.consoleId();
        const res = await ctx.client.requestNetwork("GET", cid, "/v1/sites");
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
```

- [ ] **Step 2: devices.ts schreiben (mit reboot + port-action Wrappern)**

```ts
// src/tools/network/devices.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

async function getAt(ctx: ServerContext, method: "GET" | "POST" | "DELETE", path: (siteId: string) => string, body?: unknown) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork(method, cid, path(sid), { body });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

export function registerDeviceTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_devices",
    {
      title: "List adopted devices",
      description: "Adopted UniFi devices on the current site. Plausibility anchor: ~16 devices.",
      inputSchema: pagShape,
      annotations: readOnly,
    },
    async (a) => {
      try {
        const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
        const res = await ctx.client.requestNetwork("GET", cid, `/v1/sites/${sid}/devices`, {
          query: { offset: a.offset, limit: a.limit, filter: a.filter },
        });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );

  server.registerTool(
    "unifi_net_get_device",
    {
      title: "Get device details",
      description: "Detail for a single adopted device.",
      inputSchema: { deviceId: z.string() },
      annotations: readOnly,
    },
    async (a) => getAt(ctx, "GET", (sid) => `/v1/sites/${sid}/devices/${a.deviceId}`),
  );

  server.registerTool(
    "unifi_net_get_device_stats",
    {
      title: "Get latest device statistics",
      description: "Latest statistics snapshot.",
      inputSchema: { deviceId: z.string() },
      annotations: readOnly,
    },
    async (a) => getAt(ctx, "GET", (sid) => `/v1/sites/${sid}/devices/${a.deviceId}/statistics/latest`),
  );

  server.registerTool(
    "unifi_net_list_pending_devices",
    {
      title: "List pending devices",
      description: "Devices waiting to be adopted.",
      inputSchema: pagShape,
      annotations: readOnly,
    },
    async (a) => {
      try {
        const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
        const res = await ctx.client.requestNetwork("GET", cid, `/v1/sites/${sid}/devices/pending`, {
          query: { offset: a.offset, limit: a.limit, filter: a.filter },
        });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );

  server.registerTool(
    "unifi_net_adopt_devices",
    {
      title: "Adopt pending devices",
      description: "Adopts pending devices by MAC.",
      inputSchema: {
        macs: z.array(z.string()).min(1).describe("Device MAC addresses to adopt"),
        ...confirmShape,
      },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/devices/actions/adopt`;
      const body = { macs: a.macs };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_adopt_devices", method: "POST", url: docPath, body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );

  server.registerTool(
    "unifi_net_device_action",
    {
      title: "Execute device action",
      description: "Generic device action (e.g. reboot, restart). Uses the `executeadopteddeviceaction` endpoint.",
      inputSchema: {
        deviceId: z.string(),
        action: z.string().describe('e.g. "restart"'),
        ...confirmShape,
      },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/devices/${a.deviceId}/actions`;
      const body = { action: a.action };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_device_action", method: "POST", url: docPath, body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );

  server.registerTool(
    "unifi_net_reboot_device",
    {
      title: "Reboot device",
      description: "Convenience wrapper over device_action with action=restart.",
      inputSchema: { deviceId: z.string(), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/devices/${a.deviceId}/actions`;
      const body = { action: "restart" };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_reboot_device", method: "POST", url: docPath, body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );

  server.registerTool(
    "unifi_net_port_action",
    {
      title: "Execute switch port action",
      description: "Power-cycle or set port profile on a switch port.",
      inputSchema: {
        deviceId: z.string(),
        portIdx: z.number().int(),
        action: z.string().describe('e.g. "power-cycle"'),
        body: z.unknown().optional().describe("Extra action payload"),
        ...confirmShape,
      },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/devices/${a.deviceId}/interfaces/ports/${a.portIdx}/actions`;
      const body = { action: a.action, ...(a.body as Record<string, unknown> | undefined) };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_port_action", method: "POST", url: docPath, body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );

  server.registerTool(
    "unifi_net_remove_device",
    {
      title: "Remove (unadopt) device",
      description: "Removes an adopted device from the site.",
      inputSchema: { deviceId: z.string(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/devices/${a.deviceId}`;
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_remove_device", method: "DELETE", url: docPath }, async () => {
        try {
          const res = await ctx.client.requestNetwork("DELETE", cid, docPath);
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
```

- [ ] **Step 3: Failing Test schreiben (mit Mock-Discovery + Mock-Client)**

```ts
// tests/unit/network.devices.test.ts
import { describe, expect, it, vi } from "vitest";
import { registerDeviceTools } from "../../src/tools/network/devices.js";

function mkCtx() {
  const requestNetwork = vi.fn().mockResolvedValue({ data: { data: [], totalCount: 0 }, status: 200, headers: new Headers() });
  const ctx = {
    cfg: { confirmWrites: false },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    client: { request: vi.fn(), requestNetwork },
    discovery: { consoleId: vi.fn().mockResolvedValue("C1"), networkSiteId: vi.fn().mockResolvedValue("S1") },
  };
  return { ctx, requestNetwork };
}

describe("network device tools", () => {
  it("registers all 9 device tools", () => {
    const { ctx } = mkCtx();
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) } as unknown as Parameters<typeof registerDeviceTools>[0];
    registerDeviceTools(server, ctx as unknown as Parameters<typeof registerDeviceTools>[1]);
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi_net_list_devices",
        "unifi_net_get_device",
        "unifi_net_get_device_stats",
        "unifi_net_list_pending_devices",
        "unifi_net_adopt_devices",
        "unifi_net_device_action",
        "unifi_net_reboot_device",
        "unifi_net_port_action",
        "unifi_net_remove_device",
      ]),
    );
  });

  it("reboot_device sends action=restart", async () => {
    const { ctx, requestNetwork } = mkCtx();
    let handler!: (a: { deviceId: string }) => Promise<unknown>;
    const server = {
      registerTool: (n: string, _def: unknown, h: typeof handler) => {
        if (n === "unifi_net_reboot_device") handler = h;
      },
    } as unknown as Parameters<typeof registerDeviceTools>[0];
    registerDeviceTools(server, ctx as unknown as Parameters<typeof registerDeviceTools>[1]);
    await handler({ deviceId: "D1" });
    expect(requestNetwork).toHaveBeenCalledWith(
      "POST",
      "C1",
      "/v1/sites/S1/devices/D1/actions",
      expect.objectContaining({ body: { action: "restart" } }),
    );
  });
});
```

- [ ] **Step 4: Tests laufen lassen, FAIL→PASS**

```bash
npm run test:unit -- tests/unit/network.devices.test.ts
```

Expected: PASS.

- [ ] **Step 5: In server.ts registrieren**

```ts
import { registerInfoTools } from "./tools/network/info.js";
import { registerSitesTools } from "./tools/network/sites.js";
import { registerDeviceTools } from "./tools/network/devices.js";
// ...
registerInfoTools(server, ctx);
registerSitesTools(server, ctx);
registerDeviceTools(server, ctx);
```

- [ ] **Step 6: Build**

```bash
npm run build
```

---

## Task 17: Network — Clients (src/tools/network/clients.ts)

**Files:**
- Create: `src/tools/network/clients.ts`
- Modify: `src/server.ts`

Plausibilitäts-Anker: 8 connected clients.

- [ ] **Step 1: clients.ts schreiben**

```ts
// src/tools/network/clients.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

export function registerClientTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_clients",
    {
      title: "List connected clients",
      description: "Currently connected clients on the site.",
      inputSchema: pagShape,
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/clients`, { offset: a.offset, limit: a.limit, filter: a.filter }),
  );

  server.registerTool(
    "unifi_net_get_client",
    {
      title: "Get connected client",
      description: "Detail for a connected client by id.",
      inputSchema: { clientId: z.string() },
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/clients/${a.clientId}`),
  );

  server.registerTool(
    "unifi_net_client_action",
    {
      title: "Execute client action",
      description: "Action on a connected client (e.g. block/unblock/reconnect).",
      inputSchema: {
        clientId: z.string(),
        action: z.string().describe('e.g. "block", "unblock", "reconnect"'),
        ...confirmShape,
      },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/clients/${a.clientId}/actions`;
      const body = { action: a.action };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_client_action", method: "POST", url: docPath, body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );

  server.registerTool(
    "unifi_net_block_client",
    {
      title: "Block client",
      description: "Convenience wrapper: client_action with action=block.",
      inputSchema: { clientId: z.string(), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/clients/${a.clientId}/actions`;
      const body = { action: "block" };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_block_client", method: "POST", url: docPath, body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );

  server.registerTool(
    "unifi_net_unblock_client",
    {
      title: "Unblock client",
      description: "Convenience wrapper: client_action with action=unblock.",
      inputSchema: { clientId: z.string(), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/clients/${a.clientId}/actions`;
      const body = { action: "unblock" };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_unblock_client", method: "POST", url: docPath, body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
```

- [ ] **Step 2: In server.ts registrieren**

```ts
import { registerClientTools } from "./tools/network/clients.js";
// ...
registerClientTools(server, ctx);
```

- [ ] **Step 3: Build + smoke**

```bash
npm run typecheck && npm run build
```

---

## Task 18: Network — Networks CRUD (src/tools/network/networks.ts)

Plausibilitäts-Anker: 3 networks.

**Files:**
- Create: `src/tools/network/networks.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: networks.ts mit 6 Tools schreiben**

Tools (vollständige Liste):

| Name | Methode | Pfad | Annotation |
|---|---|---|---|
| `unifi_net_list_networks` | GET | `/v1/sites/{sid}/networks` | readOnly |
| `unifi_net_get_network` | GET | `/v1/sites/{sid}/networks/{id}` | readOnly |
| `unifi_net_get_network_references` | GET | `/v1/sites/{sid}/networks/{id}/references` | readOnly |
| `unifi_net_create_network` | POST | `/v1/sites/{sid}/networks` | writeOnce |
| `unifi_net_update_network` | PUT | `/v1/sites/{sid}/networks/{id}` | writeIdempotent |
| `unifi_net_delete_network` | DELETE | `/v1/sites/{sid}/networks/{id}` | writeIdempotent |

Implementierung (vollständig):

```ts
// src/tools/network/networks.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

async function netWrite(
  ctx: ServerContext,
  a: { confirm?: "YES" },
  toolName: string,
  method: "POST" | "PUT" | "DELETE",
  pathBuilder: (sid: string) => string,
  body?: unknown,
) {
  const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
  const docPath = pathBuilder(sid);
  return runGuarded(ctx.cfg, a, { toolName, method, url: docPath, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, cid, docPath, { body });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerNetworkTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_networks",
    { title: "List networks", description: "Networks configured on the current site (~3 expected).", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/networks`, { offset: a.offset, limit: a.limit, filter: a.filter }),
  );
  server.registerTool(
    "unifi_net_get_network",
    { title: "Get network", description: "Detail for one network.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/networks/${a.id}`),
  );
  server.registerTool(
    "unifi_net_get_network_references",
    { title: "Get network references", description: "References to this network from other objects.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/networks/${a.id}/references`),
  );
  server.registerTool(
    "unifi_net_create_network",
    {
      title: "Create network",
      description: "Creates a new network on the current site. Body shape per Network API docs.",
      inputSchema: { body: z.unknown().describe("Network create payload"), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => netWrite(ctx, a, "unifi_net_create_network", "POST", (sid) => `/v1/sites/${sid}/networks`, a.body),
  );
  server.registerTool(
    "unifi_net_update_network",
    {
      title: "Update network",
      description: "Updates an existing network.",
      inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_update_network", "PUT", (sid) => `/v1/sites/${sid}/networks/${a.id}`, a.body),
  );
  server.registerTool(
    "unifi_net_delete_network",
    {
      title: "Delete network",
      description: "Deletes a network. IRREVERSIBLE.",
      inputSchema: { id: z.string(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_delete_network", "DELETE", (sid) => `/v1/sites/${sid}/networks/${a.id}`),
  );
}
```

- [ ] **Step 2: In server.ts registrieren**

```ts
import { registerNetworkTools } from "./tools/network/networks.js";
// ...
registerNetworkTools(server, ctx);
```

- [ ] **Step 3: Build prüfen**

```bash
npm run typecheck && npm run build
```

---

## Task 19: Network — WiFi Broadcasts CRUD (src/tools/network/wifi.ts)

Plausibilitäts-Anker: 3 WLANs.

**Files:**
- Create: `src/tools/network/wifi.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: wifi.ts schreiben (vollständiger Code)**

Tools-Übersicht:

| Name | Methode | Pfad | Annotation |
|---|---|---|---|
| `unifi_net_list_wifi` | GET | `/v1/sites/{sid}/wifi/broadcasts` | readOnly |
| `unifi_net_get_wifi` | GET | `/v1/sites/{sid}/wifi/broadcasts/{id}` | readOnly |
| `unifi_net_create_wifi` | POST | `/v1/sites/{sid}/wifi/broadcasts` | writeOnce |
| `unifi_net_update_wifi` | PUT | `/v1/sites/{sid}/wifi/broadcasts/{id}` | writeIdempotent |
| `unifi_net_delete_wifi` | DELETE | `/v1/sites/{sid}/wifi/broadcasts/{id}` | writeIdempotent |

Vollständige Implementierung:

```ts
// src/tools/network/wifi.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

async function netWrite(
  ctx: ServerContext,
  a: { confirm?: "YES" },
  toolName: string,
  method: "POST" | "PUT" | "DELETE",
  pathBuilder: (sid: string) => string,
  body?: unknown,
) {
  const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
  const docPath = pathBuilder(sid);
  return runGuarded(ctx.cfg, a, { toolName, method, url: docPath, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, cid, docPath, { body });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerWifiTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_wifi",
    { title: "List WiFi broadcasts", description: "WLAN broadcasts (~3 expected).", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/wifi/broadcasts`, { offset: a.offset, limit: a.limit, filter: a.filter }),
  );
  server.registerTool(
    "unifi_net_get_wifi",
    { title: "Get WiFi broadcast", description: "Detail for a WLAN.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/wifi/broadcasts/${a.id}`),
  );
  server.registerTool(
    "unifi_net_create_wifi",
    { title: "Create WiFi broadcast", description: "Creates a new WLAN.", inputSchema: { body: z.unknown(), ...confirmShape }, annotations: writeOnce },
    async (a) => netWrite(ctx, a, "unifi_net_create_wifi", "POST", (sid) => `/v1/sites/${sid}/wifi/broadcasts`, a.body),
  );
  server.registerTool(
    "unifi_net_update_wifi",
    { title: "Update WiFi broadcast", description: "Updates an existing WLAN.", inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_update_wifi", "PUT", (sid) => `/v1/sites/${sid}/wifi/broadcasts/${a.id}`, a.body),
  );
  server.registerTool(
    "unifi_net_delete_wifi",
    { title: "Delete WiFi broadcast", description: "Deletes a WLAN. IRREVERSIBLE.", inputSchema: { id: z.string(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_delete_wifi", "DELETE", (sid) => `/v1/sites/${sid}/wifi/broadcasts/${a.id}`),
  );
}
```

- [ ] **Step 2: In server.ts registrieren**

```ts
import { registerWifiTools } from "./tools/network/wifi.js";
registerWifiTools(server, ctx);
```

- [ ] **Step 3: typecheck + build**

```bash
npm run typecheck && npm run build
```

---

## Task 20: Network — Firewall (Zones + Policies + Ordering) — `src/tools/network/firewall.ts`

Plausibilitäts-Anker: 6 firewall zones, 65 policies.

**Files:**
- Create: `src/tools/network/firewall.ts`
- Modify: `src/server.ts`

Tools (vollständige Liste):

| Name | Methode | Pfad |
|---|---|---|
| `unifi_net_list_firewall_zones` | GET | `/v1/sites/{sid}/firewall/zones` |
| `unifi_net_get_firewall_zone` | GET | `/v1/sites/{sid}/firewall/zones/{id}` |
| `unifi_net_create_firewall_zone` | POST | `/v1/sites/{sid}/firewall/zones` |
| `unifi_net_update_firewall_zone` | PUT | `/v1/sites/{sid}/firewall/zones/{id}` |
| `unifi_net_delete_firewall_zone` | DELETE | `/v1/sites/{sid}/firewall/zones/{id}` |
| `unifi_net_list_firewall_policies` | GET | `/v1/sites/{sid}/firewall/policies` |
| `unifi_net_get_firewall_policy` | GET | `/v1/sites/{sid}/firewall/policies/{id}` |
| `unifi_net_create_firewall_policy` | POST | `/v1/sites/{sid}/firewall/policies` |
| `unifi_net_update_firewall_policy` | PUT | `/v1/sites/{sid}/firewall/policies/{id}` |
| `unifi_net_patch_firewall_policy` | PATCH | `/v1/sites/{sid}/firewall/policies/{id}` |
| `unifi_net_delete_firewall_policy` | DELETE | `/v1/sites/{sid}/firewall/policies/{id}` |
| `unifi_net_get_firewall_policy_ordering` | GET | `/v1/sites/{sid}/firewall/policies/ordering` |
| `unifi_net_reorder_firewall_policies` | PUT | `/v1/sites/{sid}/firewall/policies/ordering` |

- [ ] **Step 1: firewall.ts schreiben (sortiert: zones-Block, policies-Block, ordering-Block)**

```ts
// src/tools/network/firewall.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

async function netWrite(
  ctx: ServerContext,
  a: { confirm?: "YES" },
  toolName: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  pathBuilder: (sid: string) => string,
  body?: unknown,
) {
  const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
  const docPath = pathBuilder(sid);
  return runGuarded(ctx.cfg, a, { toolName, method, url: docPath, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, cid, docPath, { body });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerFirewallTools(server: McpServer, ctx: ServerContext): void {
  // ZONES
  server.registerTool("unifi_net_list_firewall_zones",
    { title: "List firewall zones", description: "Firewall zones (~6 expected).", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/firewall/zones`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_get_firewall_zone",
    { title: "Get firewall zone", description: "Detail of a zone.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/firewall/zones/${a.id}`));
  server.registerTool("unifi_net_create_firewall_zone",
    { title: "Create firewall zone", description: "Creates a custom firewall zone.", inputSchema: { body: z.unknown(), ...confirmShape }, annotations: writeOnce },
    async (a) => netWrite(ctx, a, "unifi_net_create_firewall_zone", "POST", (sid) => `/v1/sites/${sid}/firewall/zones`, a.body));
  server.registerTool("unifi_net_update_firewall_zone",
    { title: "Update firewall zone", description: "Updates a custom zone.", inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_update_firewall_zone", "PUT", (sid) => `/v1/sites/${sid}/firewall/zones/${a.id}`, a.body));
  server.registerTool("unifi_net_delete_firewall_zone",
    { title: "Delete firewall zone", description: "Deletes a custom zone. IRREVERSIBLE.", inputSchema: { id: z.string(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_delete_firewall_zone", "DELETE", (sid) => `/v1/sites/${sid}/firewall/zones/${a.id}`));

  // POLICIES
  server.registerTool("unifi_net_list_firewall_policies",
    { title: "List firewall policies", description: "Firewall policies (~65 expected).", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/firewall/policies`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_get_firewall_policy",
    { title: "Get firewall policy", description: "Detail of a policy.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/firewall/policies/${a.id}`));
  server.registerTool("unifi_net_create_firewall_policy",
    { title: "Create firewall policy", description: "Creates a new policy. WARNING: can interrupt traffic.", inputSchema: { body: z.unknown(), ...confirmShape }, annotations: writeOnce },
    async (a) => netWrite(ctx, a, "unifi_net_create_firewall_policy", "POST", (sid) => `/v1/sites/${sid}/firewall/policies`, a.body));
  server.registerTool("unifi_net_update_firewall_policy",
    { title: "Update firewall policy", description: "Replaces a policy.", inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_update_firewall_policy", "PUT", (sid) => `/v1/sites/${sid}/firewall/policies/${a.id}`, a.body));
  server.registerTool("unifi_net_patch_firewall_policy",
    { title: "Patch firewall policy", description: "Partially updates a policy.", inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_patch_firewall_policy", "PATCH", (sid) => `/v1/sites/${sid}/firewall/policies/${a.id}`, a.body));
  server.registerTool("unifi_net_delete_firewall_policy",
    { title: "Delete firewall policy", description: "Deletes a policy. IRREVERSIBLE.", inputSchema: { id: z.string(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_delete_firewall_policy", "DELETE", (sid) => `/v1/sites/${sid}/firewall/policies/${a.id}`));

  // ORDERING
  server.registerTool("unifi_net_get_firewall_policy_ordering",
    { title: "Get firewall policy ordering", description: "User-defined ordering for firewall policies.", inputSchema: {}, annotations: readOnly },
    async () => netGet(ctx, (sid) => `/v1/sites/${sid}/firewall/policies/ordering`));
  server.registerTool("unifi_net_reorder_firewall_policies",
    {
      title: "Reorder firewall policies",
      description: "Sets the ordering for user-defined firewall policies. Body must be the ordered list of policy ids.",
      inputSchema: { body: z.unknown().describe("Ordering payload as per docs (ordered array)"), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_reorder_firewall_policies", "PUT", (sid) => `/v1/sites/${sid}/firewall/policies/ordering`, a.body));
}
```

- [ ] **Step 2: In server.ts registrieren**

```ts
import { registerFirewallTools } from "./tools/network/firewall.js";
registerFirewallTools(server, ctx);
```

- [ ] **Step 3: typecheck + build**

```bash
npm run typecheck && npm run build
```

---

## Task 21: Network — ACL Rules + Ordering (src/tools/network/acl.ts)

**Files:** Create `src/tools/network/acl.ts`, modify `src/server.ts`.

Tools:

| Name | Methode | Pfad |
|---|---|---|
| `unifi_net_list_acl_rules` | GET | `/v1/sites/{sid}/acl-rules` |
| `unifi_net_get_acl_rule` | GET | `/v1/sites/{sid}/acl-rules/{id}` |
| `unifi_net_create_acl_rule` | POST | `/v1/sites/{sid}/acl-rules` |
| `unifi_net_update_acl_rule` | PUT | `/v1/sites/{sid}/acl-rules/{id}` |
| `unifi_net_delete_acl_rule` | DELETE | `/v1/sites/{sid}/acl-rules/{id}` |
| `unifi_net_get_acl_rule_ordering` | GET | `/v1/sites/{sid}/acl-rules/ordering` |
| `unifi_net_reorder_acl_rules` | PUT | `/v1/sites/{sid}/acl-rules/ordering` |

- [ ] **Step 1: acl.ts schreiben (vollständiger Code, eigenständig)**

```ts
// src/tools/network/acl.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

async function netWrite(
  ctx: ServerContext,
  a: { confirm?: "YES" },
  toolName: string,
  method: "POST" | "PUT" | "DELETE",
  pathBuilder: (sid: string) => string,
  body?: unknown,
) {
  const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
  const docPath = pathBuilder(sid);
  return runGuarded(ctx.cfg, a, { toolName, method, url: docPath, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, cid, docPath, { body });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerAclTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool("unifi_net_list_acl_rules",
    { title: "List ACL rules", description: "ACL rules on the current site.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/acl-rules`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_get_acl_rule",
    { title: "Get ACL rule", description: "Detail for an ACL rule.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/acl-rules/${a.id}`));
  server.registerTool("unifi_net_create_acl_rule",
    { title: "Create ACL rule", description: "Creates a new ACL rule.", inputSchema: { body: z.unknown(), ...confirmShape }, annotations: writeOnce },
    async (a) => netWrite(ctx, a, "unifi_net_create_acl_rule", "POST", (sid) => `/v1/sites/${sid}/acl-rules`, a.body));
  server.registerTool("unifi_net_update_acl_rule",
    { title: "Update ACL rule", description: "Updates an ACL rule.", inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_update_acl_rule", "PUT", (sid) => `/v1/sites/${sid}/acl-rules/${a.id}`, a.body));
  server.registerTool("unifi_net_delete_acl_rule",
    { title: "Delete ACL rule", description: "Deletes an ACL rule. IRREVERSIBLE.", inputSchema: { id: z.string(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_delete_acl_rule", "DELETE", (sid) => `/v1/sites/${sid}/acl-rules/${a.id}`));
  server.registerTool("unifi_net_get_acl_rule_ordering",
    { title: "Get ACL rule ordering", description: "User-defined ACL rule ordering.", inputSchema: {}, annotations: readOnly },
    async () => netGet(ctx, (sid) => `/v1/sites/${sid}/acl-rules/ordering`));
  server.registerTool("unifi_net_reorder_acl_rules",
    { title: "Reorder ACL rules", description: "Sets ordering for user-defined ACL rules.", inputSchema: { body: z.unknown(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_reorder_acl_rules", "PUT", (sid) => `/v1/sites/${sid}/acl-rules/ordering`, a.body));
}
```

- [ ] **Step 2: In server.ts registrieren**

```ts
import { registerAclTools } from "./tools/network/acl.js";
registerAclTools(server, ctx);
```

- [ ] **Step 3: typecheck + build**

```bash
npm run typecheck && npm run build
```

---

## Task 22: Network — DNS Policies + Traffic Lists (src/tools/network/dns.ts + trafficLists.ts)

**Files:** Create `src/tools/network/dns.ts`, `src/tools/network/trafficLists.ts`, modify `src/server.ts`.

### DNS Policies — Tools:

| Name | Methode | Pfad |
|---|---|---|
| `unifi_net_list_dns_policies` | GET | `/v1/sites/{sid}/dns/policies` |
| `unifi_net_get_dns_policy` | GET | `/v1/sites/{sid}/dns/policies/{id}` |
| `unifi_net_create_dns_policy` | POST | `/v1/sites/{sid}/dns/policies` |
| `unifi_net_update_dns_policy` | PUT | `/v1/sites/{sid}/dns/policies/{id}` |
| `unifi_net_delete_dns_policy` | DELETE | `/v1/sites/{sid}/dns/policies/{id}` |

### Traffic Matching Lists — Tools:

| Name | Methode | Pfad |
|---|---|---|
| `unifi_net_list_traffic_lists` | GET | `/v1/sites/{sid}/traffic-matching-lists` |
| `unifi_net_get_traffic_list` | GET | `/v1/sites/{sid}/traffic-matching-lists/{id}` |
| `unifi_net_create_traffic_list` | POST | `/v1/sites/{sid}/traffic-matching-lists` |
| `unifi_net_update_traffic_list` | PUT | `/v1/sites/{sid}/traffic-matching-lists/{id}` |
| `unifi_net_delete_traffic_list` | DELETE | `/v1/sites/{sid}/traffic-matching-lists/{id}` |

- [ ] **Step 1: dns.ts schreiben (vollständiger Code)**

```ts
// src/tools/network/dns.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

async function netWrite(
  ctx: ServerContext,
  a: { confirm?: "YES" },
  toolName: string,
  method: "POST" | "PUT" | "DELETE",
  pathBuilder: (sid: string) => string,
  body?: unknown,
) {
  const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
  const docPath = pathBuilder(sid);
  return runGuarded(ctx.cfg, a, { toolName, method, url: docPath, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, cid, docPath, { body });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerDnsTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool("unifi_net_list_dns_policies",
    { title: "List DNS policies", description: "DNS policies on the current site.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/dns/policies`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_get_dns_policy",
    { title: "Get DNS policy", description: "Detail of a DNS policy.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/dns/policies/${a.id}`));
  server.registerTool("unifi_net_create_dns_policy",
    { title: "Create DNS policy", description: "Creates a DNS policy.", inputSchema: { body: z.unknown(), ...confirmShape }, annotations: writeOnce },
    async (a) => netWrite(ctx, a, "unifi_net_create_dns_policy", "POST", (sid) => `/v1/sites/${sid}/dns/policies`, a.body));
  server.registerTool("unifi_net_update_dns_policy",
    { title: "Update DNS policy", description: "Updates a DNS policy.", inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_update_dns_policy", "PUT", (sid) => `/v1/sites/${sid}/dns/policies/${a.id}`, a.body));
  server.registerTool("unifi_net_delete_dns_policy",
    { title: "Delete DNS policy", description: "Deletes a DNS policy. IRREVERSIBLE.", inputSchema: { id: z.string(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_delete_dns_policy", "DELETE", (sid) => `/v1/sites/${sid}/dns/policies/${a.id}`));
}
```

- [ ] **Step 1b: trafficLists.ts schreiben (vollständiger Code)**

```ts
// src/tools/network/trafficLists.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

async function netWrite(
  ctx: ServerContext,
  a: { confirm?: "YES" },
  toolName: string,
  method: "POST" | "PUT" | "DELETE",
  pathBuilder: (sid: string) => string,
  body?: unknown,
) {
  const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
  const docPath = pathBuilder(sid);
  return runGuarded(ctx.cfg, a, { toolName, method, url: docPath, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, cid, docPath, { body });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerTrafficListTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool("unifi_net_list_traffic_lists",
    { title: "List traffic matching lists", description: "Traffic matching lists on the current site.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/traffic-matching-lists`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_get_traffic_list",
    { title: "Get traffic matching list", description: "Detail of a traffic matching list.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/traffic-matching-lists/${a.id}`));
  server.registerTool("unifi_net_create_traffic_list",
    { title: "Create traffic matching list", description: "Creates a traffic matching list.", inputSchema: { body: z.unknown(), ...confirmShape }, annotations: writeOnce },
    async (a) => netWrite(ctx, a, "unifi_net_create_traffic_list", "POST", (sid) => `/v1/sites/${sid}/traffic-matching-lists`, a.body));
  server.registerTool("unifi_net_update_traffic_list",
    { title: "Update traffic matching list", description: "Updates a traffic matching list.", inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_update_traffic_list", "PUT", (sid) => `/v1/sites/${sid}/traffic-matching-lists/${a.id}`, a.body));
  server.registerTool("unifi_net_delete_traffic_list",
    { title: "Delete traffic matching list", description: "Deletes a traffic matching list. IRREVERSIBLE.", inputSchema: { id: z.string(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_delete_traffic_list", "DELETE", (sid) => `/v1/sites/${sid}/traffic-matching-lists/${a.id}`));
}
```

- [ ] **Step 2: server.ts erweitern**

```ts
import { registerDnsTools } from "./tools/network/dns.js";
import { registerTrafficListTools } from "./tools/network/trafficLists.js";
registerDnsTools(server, ctx);
registerTrafficListTools(server, ctx);
```

- [ ] **Step 3: typecheck + build**

```bash
npm run typecheck && npm run build
```

---

## Task 23: Network — Hotspot Vouchers (src/tools/network/hotspot.ts)

**Files:** Create `src/tools/network/hotspot.ts`, modify `src/server.ts`.

Tools:

| Name | Methode | Pfad |
|---|---|---|
| `unifi_net_list_vouchers` | GET | `/v1/sites/{sid}/hotspot/vouchers` |
| `unifi_net_get_voucher` | GET | `/v1/sites/{sid}/hotspot/vouchers/{id}` |
| `unifi_net_create_vouchers` | POST | `/v1/sites/{sid}/hotspot/vouchers` |
| `unifi_net_delete_voucher` | DELETE | `/v1/sites/{sid}/hotspot/vouchers/{id}` |
| `unifi_net_delete_vouchers` | DELETE | `/v1/sites/{sid}/hotspot/vouchers` |

- [ ] **Step 1: hotspot.ts schreiben (vollständiger Code)**

```ts
// src/tools/network/hotspot.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

async function netWrite(
  ctx: ServerContext,
  a: { confirm?: "YES" },
  toolName: string,
  method: "POST" | "DELETE",
  pathBuilder: (sid: string) => string,
  body?: unknown,
) {
  const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
  const docPath = pathBuilder(sid);
  return runGuarded(ctx.cfg, a, { toolName, method, url: docPath, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, cid, docPath, { body });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerHotspotTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool("unifi_net_list_vouchers",
    { title: "List hotspot vouchers", description: "Hotspot vouchers on the current site.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/hotspot/vouchers`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_get_voucher",
    { title: "Get hotspot voucher", description: "Detail of a hotspot voucher.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/hotspot/vouchers/${a.id}`));
  server.registerTool("unifi_net_create_vouchers",
    {
      title: "Generate hotspot vouchers",
      description: "Generates one or more hotspot vouchers. Body shape per UniFi docs (count, name, duration, …).",
      inputSchema: { body: z.unknown().describe("Voucher generation payload"), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => netWrite(ctx, a, "unifi_net_create_vouchers", "POST", (sid) => `/v1/sites/${sid}/hotspot/vouchers`, a.body));
  server.registerTool("unifi_net_delete_voucher",
    { title: "Delete hotspot voucher", description: "Deletes a single hotspot voucher.", inputSchema: { id: z.string(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_delete_voucher", "DELETE", (sid) => `/v1/sites/${sid}/hotspot/vouchers/${a.id}`));
  server.registerTool("unifi_net_delete_vouchers",
    { title: "Delete all matching hotspot vouchers", description: "Deletes multiple vouchers (filter via query body).", inputSchema: { body: z.unknown().optional(), ...confirmShape }, annotations: writeIdempotent },
    async (a) => netWrite(ctx, a, "unifi_net_delete_vouchers", "DELETE", (sid) => `/v1/sites/${sid}/hotspot/vouchers`, a.body));
}
```

Hinweis: `unifi_net_create_vouchers` ist der Kandidat für den manuellen Schreib-Smoke-Test (siehe Task 32).

- [ ] **Step 2: server.ts erweitern**

```ts
import { registerHotspotTools } from "./tools/network/hotspot.js";
registerHotspotTools(server, ctx);
```

- [ ] **Step 3: typecheck + build**

```bash
npm run typecheck && npm run build
```

---

## Task 24: Network — Switching + Supporting (src/tools/network/switching.ts + supporting.ts)

**Files:** Create `src/tools/network/switching.ts`, `src/tools/network/supporting.ts`, modify `src/server.ts`.

### Switching — Tools (alle read-only):

| Name | Methode | Pfad |
|---|---|---|
| `unifi_net_list_switch_stacks` | GET | `/v1/sites/{sid}/switch-stacks` |
| `unifi_net_get_switch_stack` | GET | `/v1/sites/{sid}/switch-stacks/{id}` |
| `unifi_net_list_mclag_domains` | GET | `/v1/sites/{sid}/mclag-domains` |
| `unifi_net_get_mclag_domain` | GET | `/v1/sites/{sid}/mclag-domains/{id}` |
| `unifi_net_list_lags` | GET | `/v1/sites/{sid}/lags` |
| `unifi_net_get_lag` | GET | `/v1/sites/{sid}/lags/{id}` |

### Supporting Resources — Tools (alle read-only):

| Name | Methode | Pfad |
|---|---|---|
| `unifi_net_list_wans` | GET | `/v1/sites/{sid}/wans` (Anker: 2 WANs) |
| `unifi_net_list_site_to_site_vpn` | GET | `/v1/sites/{sid}/vpn/site-to-site-tunnels` |
| `unifi_net_list_vpn_servers` | GET | `/v1/sites/{sid}/vpn/servers` |
| `unifi_net_list_radius_profiles` | GET | `/v1/sites/{sid}/radius-profiles` |
| `unifi_net_list_device_tags` | GET | `/v1/sites/{sid}/device-tags` |
| `unifi_net_list_dpi_application_categories` | GET | `/v1/sites/{sid}/dpi/application-categories` |
| `unifi_net_list_dpi_applications` | GET | `/v1/sites/{sid}/dpi/applications` |
| `unifi_net_list_countries` | GET | `/v1/countries` (kein siteId — direkt am Network-API-Root) |

> Hinweis zu `unifi_net_list_countries`: Pfad enthält **keinen** siteId-Anteil. Implementierung ruft `ctx.client.requestNetwork(method, cid, "/v1/countries")` ohne siteId-Discovery.

- [ ] **Step 1: switching.ts schreiben (vollständiger Code, alles read-only)**

```ts
// src/tools/network/switching.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

export function registerSwitchingTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool("unifi_net_list_switch_stacks",
    { title: "List switch stacks", description: "Switch stacks on the site.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/switch-stacks`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_get_switch_stack",
    { title: "Get switch stack", description: "Detail of a switch stack.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/switch-stacks/${a.id}`));
  server.registerTool("unifi_net_list_mclag_domains",
    { title: "List MC-LAG domains", description: "MC-LAG domains on the site.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/mclag-domains`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_get_mclag_domain",
    { title: "Get MC-LAG domain", description: "Detail of an MC-LAG domain.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/mclag-domains/${a.id}`));
  server.registerTool("unifi_net_list_lags",
    { title: "List LAGs", description: "Link aggregation groups on the site.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/lags`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_get_lag",
    { title: "Get LAG", description: "Detail of a LAG.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/lags/${a.id}`));
}
```

- [ ] **Step 1b: supporting.ts schreiben (vollständiger Code, alles read-only)**

```ts
// src/tools/network/supporting.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGetSite(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

async function netGetRoot(ctx: ServerContext, path: string, query?: Record<string, string | number | undefined>) {
  try {
    const cid = await ctx.discovery.consoleId();
    const res = await ctx.client.requestNetwork("GET", cid, path, { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

export function registerSupportingTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool("unifi_net_list_wans",
    { title: "List WAN interfaces", description: "WAN interfaces (~2 expected).", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGetSite(ctx, (sid) => `/v1/sites/${sid}/wans`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_list_site_to_site_vpn",
    { title: "List site-to-site VPN tunnels", description: "Site-to-site VPN tunnels.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGetSite(ctx, (sid) => `/v1/sites/${sid}/vpn/site-to-site-tunnels`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_list_vpn_servers",
    { title: "List VPN servers", description: "VPN servers on the site.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGetSite(ctx, (sid) => `/v1/sites/${sid}/vpn/servers`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_list_radius_profiles",
    { title: "List RADIUS profiles", description: "RADIUS profiles on the site.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGetSite(ctx, (sid) => `/v1/sites/${sid}/radius-profiles`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_list_device_tags",
    { title: "List device tags", description: "Device tags on the site.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGetSite(ctx, (sid) => `/v1/sites/${sid}/device-tags`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_list_dpi_application_categories",
    { title: "List DPI application categories", description: "DPI application categories.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGetSite(ctx, (sid) => `/v1/sites/${sid}/dpi/application-categories`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_list_dpi_applications",
    { title: "List DPI applications", description: "DPI applications.", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGetSite(ctx, (sid) => `/v1/sites/${sid}/dpi/applications`, { offset: a.offset, limit: a.limit, filter: a.filter }));
  server.registerTool("unifi_net_list_countries",
    { title: "List countries", description: "Country list (no siteId needed — Network-API root).", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGetRoot(ctx, "/v1/countries", { offset: a.offset, limit: a.limit, filter: a.filter }));
}
```

- [ ] **Step 2: server.ts erweitern**

```ts
import { registerSwitchingTools } from "./tools/network/switching.js";
import { registerSupportingTools } from "./tools/network/supporting.js";
registerSwitchingTools(server, ctx);
registerSupportingTools(server, ctx);
```

- [ ] **Step 3: typecheck + build**

```bash
npm run typecheck && npm run build
```

- [ ] **Step 4: Smoke — alle Hand-Wrapper laden, Tool-Anzahl prüfen**

```bash
npm run test:unit
```

Expected: alle Tests grün, keine doppelten Tool-Namen.

---

## Task 25: Codegen — Katalog (src/codegen/catalog.ts)

**Files:**
- Create: `src/codegen/catalog.ts`

Enthält die vollständige Liste der Doku-Seitennamen aus Brief §4. Pro Eintrag: `surface` ("siteManager" | "network"), `docPath` (URL-Pfad nach `https://developer.ui.com/`), und `toolName` (generierter Tool-Name, `unifi_gen_<docPageName>`).

- [ ] **Step 1: catalog.ts schreiben**

```ts
// src/codegen/catalog.ts
export type Surface = "siteManager" | "network";

export interface CatalogEntry {
  surface: Surface;
  docPath: string;       // path appended to https://developer.ui.com/
  toolName: string;      // e.g. unifi_gen_createfirewallpolicy
}

const SITE_MANAGER_VERSION = "site-manager/v1.0.0";
const NETWORK_VERSION = "network/v10.3.58";

const SITE_MANAGER_PAGES = [
  "listhosts", "gethost", "listsites", "listdevices",
  "getispmetrics", "queryispmetrics",
  "listsdwanconfigs", "getsdwanconfig", "getsdwanconfigstatus",
  // connector catch-alls
  "connectorget", "connectorpost", "connectorput", "connectordelete", "connectorpatch",
];

const NETWORK_PAGES = [
  // Application Info
  "getinfo",
  // Sites
  "getsiteoverviewpage",
  // UniFi Devices
  "getadopteddeviceoverviewpage", "getadopteddevicedetails", "getadopteddevicelateststatistics",
  "getpendingdevicepage", "adoptdevice", "executeportaction", "executeadopteddeviceaction",
  "removedevice",
  // Clients
  "getconnectedclientoverviewpage", "getconnectedclientdetails", "executeconnectedclientaction",
  // Networks
  "getnetworksoverviewpage", "getnetworkdetails", "getnetworkreferences",
  "createnetwork", "updatenetwork", "deletenetwork",
  // WiFi Broadcasts
  "getwifibroadcastpage", "getwifibroadcastdetails",
  "createwifibroadcast", "updatewifibroadcast", "deletewifibroadcast",
  // Hotspot
  "getvouchers", "getvoucher", "createvouchers", "deletevouchers", "deletevoucher",
  // Firewall
  "getfirewallzones", "getfirewallzone", "createfirewallzone", "updatefirewallzone", "deletefirewallzone",
  "getfirewallpolicies", "getfirewallpolicy", "createfirewallpolicy", "updatefirewallpolicy",
  "patchfirewallpolicy", "deletefirewallpolicy", "getfirewallpolicyordering", "updatefirewallpolicyordering",
  // ACL Rules
  "getaclrulepage", "getaclrule", "createaclrule", "updateaclrule", "deleteaclrule",
  "getaclruleordering", "updateaclruleordering",
  // Switching
  "getswitchstackpage", "getswitchstack", "getmclagdomainpage", "getmclagdomain",
  "getlagpage", "getlag",
  // DNS Policies
  "getdnspolicypage", "getdnspolicy", "creatednspolicy", "updatednspolicy", "deletednspolicy",
  // Traffic Matching Lists
  "gettrafficmatchinglists", "gettrafficmatchinglist", "createtrafficmatchinglist",
  "updatetrafficmatchinglist", "deletetrafficmatchinglist",
  // Supporting
  "getwansoverviewpage", "getsitetositevpntunnelpage", "getvpnserverpage",
  "getradiusprofileoverviewpage", "getdevicetagpage",
  "getdpiapplicationcategories", "getdpiapplications", "getcountries",
];

export const CATALOG: CatalogEntry[] = [
  ...SITE_MANAGER_PAGES.map((p) => ({
    surface: "siteManager" as Surface,
    docPath: `${SITE_MANAGER_VERSION}/${p}`,
    toolName: `unifi_gen_${p}`,
  })),
  ...NETWORK_PAGES.map((p) => ({
    surface: "network" as Surface,
    docPath: `${NETWORK_VERSION}/${p}`,
    toolName: `unifi_gen_${p}`,
  })),
];

export const SITE_MANAGER_BASE = `https://developer.ui.com/${SITE_MANAGER_VERSION}`;
export const NETWORK_BASE = `https://developer.ui.com/${NETWORK_VERSION}`;
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

---

## Task 26: Codegen — RSC Parser Snapshot-Tests (tests/unit/codegen.rsc.test.ts)

**Files:**
- Create: `tests/fixtures/rsc/createfirewallpolicy.txt` — gespeicherte RSC-Antwort (3–5 Endpunkte als Fixtures)
- Create: `tests/unit/codegen.rsc.test.ts`

- [ ] **Step 1: Live-Fixture für 1 Doku-Seite holen und einchecken**

```bash
mkdir -p tests/fixtures/rsc
curl -sSL --fail "https://developer.ui.com/network/v10.3.58/createfirewallpolicy" -H "RSC: 1" -o tests/fixtures/rsc/createfirewallpolicy.txt
wc -c tests/fixtures/rsc/createfirewallpolicy.txt
```

Expected: Datei > 10 KB. Falls Fetch fehlschlägt, wiederhole 2-3× (manchmal cold-start beim CDN).

- [ ] **Step 2: Weitere 2 Fixtures holen**

```bash
curl -sSL --fail "https://developer.ui.com/network/v10.3.58/getinfo" -H "RSC: 1" -o tests/fixtures/rsc/getinfo.txt
curl -sSL --fail "https://developer.ui.com/network/v10.3.58/deletefirewallpolicy" -H "RSC: 1" -o tests/fixtures/rsc/deletefirewallpolicy.txt
```

- [ ] **Step 3: Snapshot-Test schreiben**

```ts
// tests/unit/codegen.rsc.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { extractEndpointJson } from "../../src/client/rsc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (n: string) => readFileSync(resolve(__dirname, "../fixtures/rsc", n), "utf8");

describe("RSC parser against live fixtures", () => {
  it("parses createfirewallpolicy fixture", () => {
    const ep = extractEndpointJson(fx("createfirewallpolicy.txt"));
    expect(ep).not.toBeNull();
    expect(ep?.method).toBe("POST");
    expect(ep?.path).toContain("/firewall/policies");
    expect(ep?.requestBody).toBeDefined();
  });

  it("parses getinfo fixture", () => {
    const ep = extractEndpointJson(fx("getinfo.txt"));
    expect(ep?.method).toBe("GET");
    expect(ep?.path).toContain("/info");
  });

  it("parses deletefirewallpolicy fixture", () => {
    const ep = extractEndpointJson(fx("deletefirewallpolicy.txt"));
    expect(ep?.method).toBe("DELETE");
    expect(ep?.path).toContain("/firewall/policies/");
  });
});
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/codegen.rsc.test.ts
```

Falls FAIL: `extractEndpointJson` debuggen, ggf. den Tail-Search-Loop verbessern; nach Fix wieder testen.

---

## Task 27: Codegen — schemaFromDoc (src/codegen/schemaFromDoc.ts)

**Files:**
- Create: `src/codegen/schemaFromDoc.ts`
- Test: `tests/unit/codegen.schema.test.ts`

Konvertiert ein JSON-Schema-ähnliches Doku-Schema in einen Zod-Ausdruck als String (Quelle für Codegen-Output).

- [ ] **Step 1: Failing Test schreiben**

```ts
// tests/unit/codegen.schema.test.ts
import { describe, expect, it } from "vitest";
import { schemaToZodSource } from "../../src/codegen/schemaFromDoc.js";

describe("schemaToZodSource", () => {
  it("emits z.string() for type string", () => {
    expect(schemaToZodSource({ type: "string" })).toBe("z.string()");
  });
  it("emits z.number() with optional min/max", () => {
    expect(schemaToZodSource({ type: "integer", minimum: 0, maximum: 100 })).toBe(
      "z.number().int().min(0).max(100)",
    );
  });
  it("emits z.enum for enum strings", () => {
    expect(schemaToZodSource({ type: "string", enum: ["a", "b"] })).toBe('z.enum(["a","b"])');
  });
  it("emits z.array(inner)", () => {
    expect(schemaToZodSource({ type: "array", items: { type: "string" } })).toBe("z.array(z.string())");
  });
  it("emits z.object for type object with properties", () => {
    const out = schemaToZodSource({
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" }, age: { type: "integer" } },
    });
    expect(out).toContain("z.object({");
    expect(out).toContain("name: z.string()");
    expect(out).toContain("age: z.number().int().optional()");
  });
  it("emits z.union for oneOf", () => {
    expect(schemaToZodSource({ oneOf: [{ type: "string" }, { type: "number" }] })).toBe(
      "z.union([z.string(),z.number()])",
    );
  });
  it("falls back to z.unknown() for unparseable", () => {
    expect(schemaToZodSource({ type: "weird-type" } as unknown as Record<string, unknown>)).toBe("z.unknown()");
  });
});
```

- [ ] **Step 2: Test laufen lassen, FAIL erwarten**

```bash
npm run test:unit -- tests/unit/codegen.schema.test.ts
```

- [ ] **Step 3: schemaFromDoc implementieren**

```ts
// src/codegen/schemaFromDoc.ts
type DocSchema = Record<string, unknown>;

export function schemaToZodSource(schema: DocSchema | undefined, refs: Record<string, DocSchema> = {}): string {
  if (!schema || typeof schema !== "object") return "z.unknown()";

  // $ref resolution
  if (typeof schema.$ref === "string") {
    const ref = schema.$ref;
    const name = ref.split("/").pop()!;
    if (refs[name]) return schemaToZodSource(refs[name], refs);
    return "z.unknown()";
  }

  // oneOf / anyOf → union
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const arr = (schema.oneOf ?? schema.anyOf) as DocSchema[];
    const parts = arr.map((s) => schemaToZodSource(s, refs));
    return `z.union([${parts.join(",")}])`;
  }

  // allOf → object merge (simple flavour: spread properties from each)
  if (Array.isArray(schema.allOf)) {
    const merged: DocSchema = { type: "object", properties: {}, required: [] };
    for (const part of schema.allOf as DocSchema[]) {
      if (part.properties) Object.assign(merged.properties as object, part.properties as object);
      if (Array.isArray(part.required)) (merged.required as string[]).push(...(part.required as string[]));
    }
    return schemaToZodSource(merged, refs);
  }

  const t = schema.type;
  if (typeof schema.enum !== "undefined" && Array.isArray(schema.enum)) {
    const vals = (schema.enum as unknown[]).filter((v) => typeof v === "string") as string[];
    if (vals.length) return `z.enum([${vals.map((v) => JSON.stringify(v)).join(",")}])`;
  }

  if (t === "string") {
    let out = "z.string()";
    if (typeof schema.minLength === "number") out += `.min(${schema.minLength})`;
    if (typeof schema.maxLength === "number") out += `.max(${schema.maxLength})`;
    if (schema.format === "uuid") out += ".uuid()";
    if (schema.format === "uri") out += ".url()";
    return out;
  }
  if (t === "integer" || t === "number") {
    let out = "z.number()";
    if (t === "integer") out += ".int()";
    if (typeof schema.minimum === "number") out += `.min(${schema.minimum})`;
    if (typeof schema.maximum === "number") out += `.max(${schema.maximum})`;
    return out;
  }
  if (t === "boolean") return "z.boolean()";
  if (t === "array") {
    const items = schema.items as DocSchema | undefined;
    return `z.array(${schemaToZodSource(items, refs)})`;
  }
  if (t === "object") {
    const props = (schema.properties ?? {}) as Record<string, DocSchema>;
    const required = new Set((schema.required as string[]) ?? []);
    const lines: string[] = [];
    for (const [k, v] of Object.entries(props)) {
      const base = schemaToZodSource(v, refs);
      const safe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      lines.push(`${safe}: ${base}${required.has(k) ? "" : ".optional()"}`);
    }
    if (schema.additionalProperties === true && lines.length === 0) {
      return "z.record(z.unknown())";
    }
    const passthrough = schema.additionalProperties === true ? ".passthrough()" : "";
    return `z.object({${lines.join(",")}})${passthrough}`;
  }

  return "z.unknown()";
}
```

- [ ] **Step 4: Test laufen lassen, PASS erwarten**

```bash
npm run test:unit -- tests/unit/codegen.schema.test.ts
```

---

## Task 28: Codegen — Emit + Generate (src/codegen/emit.ts + generate.ts)

**Files:**
- Create: `src/codegen/emit.ts`
- Create: `src/codegen/generate.ts`

Wandelt einen `EndpointSpec` in eine `.ts`-Tool-Datei um und steuert den Gesamt-Pipeline-Lauf.

- [ ] **Step 1: emit.ts schreiben**

```ts
// src/codegen/emit.ts
import type { EndpointSpec } from "../client/rsc.js";
import { schemaToZodSource } from "./schemaFromDoc.js";

export interface EmitInput {
  toolName: string;
  surface: "siteManager" | "network";
  docPath: string;       // for description provenance
  endpoint: EndpointSpec;
}

const READ_ONLY = `{ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }`;
const WRITE_ONCE = `{ readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }`;
const WRITE_IDEMP = `{ readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }`;

function annotationFor(method: EndpointSpec["method"]): string {
  if (method === "GET") return READ_ONLY;
  if (method === "POST") return WRITE_ONCE;
  return WRITE_IDEMP;
}

/**
 * Build the input-schema shape literal as TS source.
 * - Path params become required strings (the path template names them).
 * - Query params become typed shapes per their `schema`.
 * - Request body becomes `body: <ZodFromSchema>` (or z.unknown() if missing).
 * - confirm shape is spread in for write operations.
 */
function buildInputShape(ep: EndpointSpec, isWrite: boolean): string {
  const parts: string[] = [];
  const params = ep.parameters ?? [];
  for (const p of params) {
    const base = schemaToZodSource(p.schema as Record<string, unknown> | undefined);
    const desc = p.description ? `.describe(${JSON.stringify(p.description)})` : "";
    const opt = p.required ? "" : ".optional()";
    const safe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p.name) ? p.name : JSON.stringify(p.name);
    parts.push(`${safe}: ${base}${desc}${opt}`);
  }
  if (ep.requestBody) {
    const inner = schemaToZodSource(ep.requestBody.schema as Record<string, unknown> | undefined);
    parts.push(`body: ${inner}`);
  }
  if (isWrite) parts.push(`...confirmShape`);
  return `{${parts.join(", ")}}`;
}

/**
 * The path template uses `{name}` placeholders; convert to a JS template literal.
 */
function pathTemplate(path: string): string {
  return path.replace(/\{([^}]+)\}/g, (_, n) => `\${encodeURIComponent(String(a.${n}))}`);
}

function queryPicker(ep: EndpointSpec): string {
  const queryParams = (ep.parameters ?? []).filter((p) => p.in === "query");
  if (queryParams.length === 0) return "undefined";
  const entries = queryParams.map((p) => {
    const safe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p.name) ? p.name : JSON.stringify(p.name);
    return `${safe}: a.${safe}`;
  });
  return `{${entries.join(", ")}}`;
}

export function emitToolFile(input: EmitInput): string {
  const { toolName, surface, docPath, endpoint } = input;
  const method = endpoint.method;
  const isWrite = method !== "GET";
  const description = `${endpoint.summary ?? endpoint.description ?? toolName} — generated from developer.ui.com/${docPath}`.replace(/\s+/g, " ").trim();
  const inputShape = buildInputShape(endpoint, isWrite);
  const annotation = annotationFor(method);

  // Network endpoints route through requestNetwork with the proxy prefix.
  // Site Manager endpoints route through client.request directly.
  const path = endpoint.path; // raw template
  const pathExpr = `\`${pathTemplate(path)}\``;
  const queryExpr = queryPicker(endpoint);

  const callExpr = surface === "network"
    ? `await ctx.client.requestNetwork("${method}", await ctx.discovery.consoleId(), ${pathExpr}, { body: ${endpoint.requestBody ? "a.body" : "undefined"}, query: ${queryExpr} })`
    : `await ctx.client.request("${method}", ${pathExpr}, { body: ${endpoint.requestBody ? "a.body" : "undefined"}, query: ${queryExpr} })`;

  const handlerBody = isWrite
    ? `
      return runGuarded(ctx.cfg, a, { toolName: ${JSON.stringify(toolName)}, method: "${method}", url: ${pathExpr}, body: ${endpoint.requestBody ? "a.body" : "undefined"} }, async () => {
        try {
          const res = ${callExpr};
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });`
    : `
      try {
        const res = ${callExpr};
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }`;

  return `// AUTO-GENERATED from ${docPath}. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    ${JSON.stringify(toolName)},
    {
      title: ${JSON.stringify(toolName)},
      description: ${JSON.stringify(description)},
      inputSchema: ${inputShape},
      annotations: ${annotation},
    },
    async (a) => {${handlerBody}
    },
  );
}
`;
}
```

- [ ] **Step 2: generate.ts schreiben (CLI-Entry)**

```ts
// src/codegen/generate.ts
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchEndpointSpec } from "../client/rsc.js";
import { CATALOG, type CatalogEntry } from "./catalog.js";
import { emitToolFile } from "./emit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../tools/generated");

async function run(): Promise<void> {
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const successes: string[] = [];
  const failures: { entry: CatalogEntry; reason: string }[] = [];
  const indexImports: string[] = [];

  for (const entry of CATALOG) {
    try {
      const ep = await fetchEndpointSpec(entry.docPath);
      if (!ep) throw new Error("no endpoint block found in RSC");
      if (!ep.method || !ep.path) throw new Error("endpoint missing method/path");
      const filename = `${entry.toolName}.ts`;
      const filePath = resolve(OUT_DIR, filename);
      const source = emitToolFile({
        toolName: entry.toolName,
        surface: entry.surface,
        docPath: entry.docPath,
        endpoint: ep,
      });
      writeFileSync(filePath, source, "utf8");
      indexImports.push(`import { register as register_${entry.toolName} } from "./${entry.toolName}.js";`);
      successes.push(entry.toolName);
    } catch (err) {
      failures.push({ entry, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  // index.ts
  const indexSource = `// AUTO-GENERATED. Do not edit by hand.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
${indexImports.join("\n")}

export function registerGeneratedTools(server: McpServer, ctx: ServerContext): void {
${successes.map((n) => `  register_${n}(server, ctx);`).join("\n")}
}
`;
  writeFileSync(resolve(OUT_DIR, "index.ts"), indexSource, "utf8");

  // Report
  process.stderr.write(`Codegen complete: ${successes.length} ok, ${failures.length} failed\n`);
  for (const f of failures) {
    process.stderr.write(`  FAIL ${f.entry.toolName} (${f.entry.docPath}): ${f.reason}\n`);
  }
  if (failures.length > 0) process.exitCode = 1;
}

run().catch((err) => {
  process.stderr.write(`codegen failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
```

- [ ] **Step 3: typecheck**

```bash
npm run typecheck
```

Expected: grün.

---

## Task 29: Codegen ausführen + Generated Tools registrieren

**Files:**
- Generate: `src/tools/generated/*` (output)
- Modify: `src/server.ts`

- [ ] **Step 1: Codegen laufen lassen**

```bash
npm run codegen
```

Expected: stderr-Bericht „Codegen complete: N ok, M failed". Falls Failures vorhanden, Logs inspizieren — pro fehlgeschlagenem Endpoint: ist die Doku-Seite überhaupt erreichbar (versuche curl mit `RSC: 1`)? Falls strukturell defekt: temporär aus `catalog.ts` entfernen und einen GitHub-Issue-Eintrag im README anlegen.

- [ ] **Step 2: Generated-Index in server.ts importieren**

```ts
import { registerGeneratedTools } from "./tools/generated/index.js";
// inside buildServer(), AFTER hand-wrappers:
registerGeneratedTools(server, ctx);
```

- [ ] **Step 3: Build prüfen**

```bash
npm run build
```

Expected: grün. ESLint ignoriert `src/tools/generated/**` (siehe Task 1, Step 4).

- [ ] **Step 4: Smoke-Run mit MCP Inspector**

```bash
npm run inspector
```

Expected: Tool-Liste ist sichtbar; suche nach `unifi_gen_listhosts` (oder einem anderen erzeugten Tool) — muss erscheinen.

---

## Task 30: Resources (src/resources/)

**Files:**
- Create: `src/resources/index.ts`, `src/resources/identity.ts`, `src/resources/hosts.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: identity.ts schreiben**

```ts
// src/resources/identity.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.js";

export function registerIdentityResource(server: McpServer, ctx: ServerContext): void {
  server.registerResource(
    "unifi-identity",
    "unifi://identity",
    { title: "Resolved UniFi identity", description: "Discovery output: consoleId + both siteIds + console metadata.", mimeType: "application/json" },
    async (uri) => {
      const id = await ctx.discovery.identity();
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(id, null, 2) }] };
    },
  );
}
```

- [ ] **Step 2: hosts.ts schreiben (Liste + Detail)**

```ts
// src/resources/hosts.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.js";

export function registerHostsResources(server: McpServer, ctx: ServerContext): void {
  server.registerResource(
    "unifi-hosts",
    "unifi://hosts",
    { title: "UniFi hosts (account)", description: "GET /v1/hosts", mimeType: "application/json" },
    async (uri) => {
      const res = await ctx.client.request("GET", "/v1/hosts");
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(res.data, null, 2) }] };
    },
  );

  server.registerResource(
    "unifi-host-detail",
    new RegExp("^unifi://hosts/(?<id>[^/]+)$"),
    { title: "UniFi host detail", description: "GET /v1/hosts/{id}", mimeType: "application/json" },
    async (uri, params) => {
      const id = (params as { id?: string }).id;
      if (!id) throw new Error("missing host id");
      const res = await ctx.client.request("GET", `/v1/hosts/${encodeURIComponent(id)}`);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(res.data, null, 2) }] };
    },
  );
}
```

> Falls die SDK-API für `registerResource` mit Template-URIs anders heißt (Inspector zeigt), entsprechend anpassen. Stand SDK 1.20.x: `server.registerResource` mit String- oder URI-Template-Eingabe.

- [ ] **Step 3: resources/index.ts schreiben**

```ts
// src/resources/index.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.js";
import { registerIdentityResource } from "./identity.js";
import { registerHostsResources } from "./hosts.js";

export function registerResources(server: McpServer, ctx: ServerContext): void {
  registerIdentityResource(server, ctx);
  registerHostsResources(server, ctx);
}
```

- [ ] **Step 4: In server.ts ergänzen**

```ts
import { registerResources } from "./resources/index.js";
// in buildServer(), nach den Tools:
registerResources(server, ctx);
```

- [ ] **Step 5: typecheck + build**

```bash
npm run typecheck && npm run build
```

---

## Task 31: Prompts (src/prompts/)

**Files:**
- Create: `src/prompts/index.ts`, `src/prompts/auditFirewall.ts`, `src/prompts/networkHealth.ts`, `src/prompts/adoptionStatus.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: auditFirewall.ts schreiben**

```ts
// src/prompts/auditFirewall.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAuditFirewallPrompt(server: McpServer): void {
  server.registerPrompt(
    "unifi-audit-firewall",
    {
      title: "Audit firewall posture",
      description: "Walks firewall zones and policies; flags disabled rules, broad allow-any-any rules, and policies without descriptions; suggests hardening.",
      argsSchema: { siteId: z.string().optional().describe("Optional Network site id; defaults to discovered site.") },
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Audit the UniFi firewall posture.",
              "1. Call `unifi_net_list_firewall_zones` and `unifi_net_list_firewall_policies` (use full pagination).",
              "2. Group policies by zone pair.",
              "3. Flag: disabled rules, allow-any-any constructs, rules without descriptions, rules created in the last 7 days.",
              `4. Site id: ${args.siteId ?? "(auto-discovered)"}.`,
              "Report concrete actions to harden the posture.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
```

- [ ] **Step 2: networkHealth.ts schreiben**

```ts
// src/prompts/networkHealth.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerNetworkHealthPrompt(server: McpServer): void {
  server.registerPrompt(
    "unifi-network-health",
    {
      title: "Network health summary",
      description: "Summarises WAN status, device online/offline counts, and top clients by activity.",
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Produce a UniFi network health summary.",
              "1. Call `unifi_net_list_wans` — list each WAN with status.",
              "2. Call `unifi_net_list_devices` — count online vs offline, list any offline device with last-seen.",
              "3. Call `unifi_net_list_clients` — top 10 by recent activity.",
              "4. Highlight anomalies and recommend actions.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
```

- [ ] **Step 3: adoptionStatus.ts schreiben**

```ts
// src/prompts/adoptionStatus.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAdoptionStatusPrompt(server: McpServer): void {
  server.registerPrompt(
    "unifi-adoption-status",
    {
      title: "Adoption status",
      description: "Reports pending adoptions and recommends accept/reject.",
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Check UniFi adoption status.",
              "1. Call `unifi_net_list_pending_devices`. If empty, report all clear.",
              "2. For each pending device, show MAC, model, and any IP seen.",
              "3. Recommend adopt / leave / investigate per device based on whether the MAC is known and expected.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
```

- [ ] **Step 4: prompts/index.ts schreiben**

```ts
// src/prompts/index.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuditFirewallPrompt } from "./auditFirewall.js";
import { registerNetworkHealthPrompt } from "./networkHealth.js";
import { registerAdoptionStatusPrompt } from "./adoptionStatus.js";

export function registerPrompts(server: McpServer): void {
  registerAuditFirewallPrompt(server);
  registerNetworkHealthPrompt(server);
  registerAdoptionStatusPrompt(server);
}
```

- [ ] **Step 5: server.ts ergänzen**

```ts
import { registerPrompts } from "./prompts/index.js";
// in buildServer(), nach den Resources:
registerPrompts(server);
```

- [ ] **Step 6: build**

```bash
npm run build
```

---

## Task 32: Integration-Smoke (live, read-only) — tests/integration/readonly-smoke.test.ts

**Files:**
- Create: `tests/integration/readonly-smoke.test.ts`

Plausibilitäts-Anker aus Spec §19: 16 devices, 8 clients, 3 networks, 3 WLANs, 6 firewall zones, 65 policies, 2 WANs. Werte sind „best effort" — bei Drift im Netzwerk passe die Erwartungswerte an oder benutze `expect(...).toBeGreaterThan(N)`.

- [ ] **Step 1: Test schreiben**

```ts
// tests/integration/readonly-smoke.test.ts
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createLogger } from "../../src/utils/logger.js";
import { UnifiClient } from "../../src/client/unifiClient.js";
import { Discovery } from "../../src/client/discovery.js";

const RUN = !!process.env.UNIFI_API_KEY;

describe.skipIf(!RUN)("live read-only smoke", () => {
  const cfg = RUN ? loadConfig() : null;
  const logger = createLogger("error");
  const client = cfg ? new UnifiClient(cfg, logger) : null;
  const discovery = cfg && client ? new Discovery(client, cfg) : null;

  it("Site Manager: lists hosts", async () => {
    const res = await client!.request<{ data: unknown[] }>("GET", "/v1/hosts");
    const data = (res.data as { data?: unknown[] })?.data ?? (res.data as unknown[]);
    expect(Array.isArray(data)).toBe(true);
  });

  it("Network: lists devices (~16 expected)", async () => {
    const cid = await discovery!.consoleId();
    const sid = await discovery!.networkSiteId();
    const res = await client!.requestNetwork<{ data: unknown[]; totalCount?: number }>("GET", cid, `/v1/sites/${sid}/devices`, { query: { limit: 200 } });
    const tc = (res.data as { totalCount?: number }).totalCount;
    expect(tc ?? (res.data as { data?: unknown[] }).data?.length).toBeGreaterThanOrEqual(10);
  });

  it("Network: lists firewall policies (~65 expected)", async () => {
    const cid = await discovery!.consoleId();
    const sid = await discovery!.networkSiteId();
    const res = await client!.requestNetwork<{ totalCount?: number; data?: unknown[] }>("GET", cid, `/v1/sites/${sid}/firewall/policies`, { query: { limit: 200 } });
    const tc = res.data.totalCount ?? res.data.data?.length;
    expect(tc).toBeGreaterThanOrEqual(20);
  });

  it("Network: identity resolves all three IDs", async () => {
    const id = await discovery!.identity();
    expect(id.consoleId).toBeTruthy();
    expect(id.networkSiteId).toBeTruthy();
    expect(id.siteManagerSiteId).toBeTruthy();
  });
}, 30_000);
```

- [ ] **Step 2: Test ohne Key (übersprungen)**

```bash
UNIFI_API_KEY= npm run test:integration
```

Expected: alle Tests `SKIP`.

- [ ] **Step 3: Test mit Key (live)**

```bash
# .env muss UNIFI_API_KEY enthalten
source .env && npm run test:integration
```

Expected: alle Tests grün.

- [ ] **Step 4: Manueller Schreib-Smoke (Voucher Roundtrip)**

Mit `npm run inspector` einmal:
1. `unifi_net_create_vouchers` aufrufen mit body `{ "count": 1, "name": "smoke-test", "expiration": 60 }` (Doku-Schema beachten).
2. Aus Response die Voucher-ID notieren.
3. `unifi_net_delete_voucher` mit dieser ID aufrufen.

Notiere im CHANGELOG: „Manuell verifiziert: Voucher-Create/Delete-Roundtrip on YYYY-MM-DD".

---

## Task 33: MCPB-Bundle (mcpb/manifest.json + scripts/build-mcpb.sh)

**Files:**
- Create: `mcpb/manifest.json`, `scripts/build-mcpb.sh`

- [ ] **Step 1: manifest.json schreiben**

```json
{
  "manifest_version": "0.1",
  "name": "the-real-unifi-mcp",
  "display_name": "UniFi MCP",
  "version": "0.1.0",
  "description": "MCP server for UniFi Site Manager + Network APIs (100% coverage, read + write, cloud-only).",
  "author": { "name": "Manuel Guttmann" },
  "license": "MIT",
  "server": { "type": "node", "entry_point": "dist/index.js" },
  "user_config": [
    { "key": "UNIFI_API_KEY", "title": "Site Manager API Key", "description": "Site Manager API key with Network scope.", "type": "secret", "required": true },
    { "key": "UNIFI_CONFIRM_WRITES", "title": "Confirm destructive writes", "description": "If true, destructive tools require confirm: \"YES\".", "type": "boolean", "default": false },
    { "key": "UNIFI_LOG_LEVEL", "title": "Log level", "description": "debug | info | warn | error", "type": "string", "default": "info" }
  ]
}
```

- [ ] **Step 2: build-mcpb.sh schreiben**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
OUT="the-real-unifi-mcp-${VERSION}.mcpb"
STAGING="$(mktemp -d)"

echo "→ build"
npm run build

echo "→ stage"
cp -r dist "$STAGING/"
cp package.json "$STAGING/"
cp README.md "$STAGING/" 2>/dev/null || true
cp LICENSE "$STAGING/" 2>/dev/null || true
cp mcpb/manifest.json "$STAGING/manifest.json"

echo "→ install production deps in staging"
(cd "$STAGING" && npm install --omit=dev --no-audit --no-fund --quiet)

echo "→ bundle"
(cd "$STAGING" && zip -qr "$ROOT/$OUT" .)

rm -rf "$STAGING"
echo "✓ wrote $OUT"
```

- [ ] **Step 3: ausführbar machen**

```bash
chmod +x scripts/build-mcpb.sh
```

- [ ] **Step 4: Bundle bauen**

```bash
npm run build:mcpb
```

Expected: `the-real-unifi-mcp-0.1.0.mcpb` im Projekt-Root.

---

## Task 34: README polish + Git-Init + Initial Commit

**Files:**
- Modify: `README.md`
- Init: Git repository

- [ ] **Step 1: README.md mit vollständiger Doku ersetzen**

```markdown
# the-real-unifi-mcp

MCP server for UniFi Site Manager + Network APIs. 100% coverage, hybrid hand-wrappers + auto-generated tools, cloud-only via `api.ui.com`. Stdio transport.

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env: set UNIFI_API_KEY (Site Manager key with Network scope)
npm run build
npm start
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `UNIFI_API_KEY` | (required) | Site Manager API key with Network scope |
| `UNIFI_API_BASE` | `https://api.ui.com` | API base URL |
| `UNIFI_CONFIRM_WRITES` | `false` | If true, destructive tools require `confirm: "YES"` |
| `UNIFI_TIMEOUT_MS` | `30000` | Per-request timeout |
| `UNIFI_LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `UNIFI_CONSOLE_ID` | — | Override discovery |
| `UNIFI_NETWORK_SITE_ID` | — | Override discovery |
| `UNIFI_SITE_MANAGER_SITE_ID` | — | Override discovery |

## Claude Desktop config

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "unifi": {
      "command": "node",
      "args": ["/absolute/path/to/the-real-unifi-mcp/dist/index.js"],
      "env": { "UNIFI_API_KEY": "your_key_here" }
    }
  }
}
```

Or install via the MCPB bundle: `npm run build:mcpb` → install `.mcpb` file in Claude Desktop.

## Tool layers

- `unifi_sm_*` — Site Manager hand-wrappers (account-level: hosts, sites, devices, ISP metrics, SD-WAN). ~10 tools.
- `unifi_net_*` — Network hand-wrappers (per-console: devices, clients, networks, WLANs, firewall, ACL, DNS, hotspot, switching, supporting). ~30+ tools.
- `unifi_gen_*` — auto-generated from UniFi docs (~140 tools). Use when no hand-wrapper exists.
- `unifi_raw_request` — escape hatch for any path/method.

## Resources

- `unifi://identity` — resolved consoleId, networkSiteId, siteManagerSiteId, console metadata.
- `unifi://hosts` — account hosts list.
- `unifi://hosts/{id}` — host detail.

## Prompts

- `unifi-audit-firewall` — firewall posture audit.
- `unifi-network-health` — WAN/devices/clients summary.
- `unifi-adoption-status` — pending adoptions report.

## Write safety

By default, destructive tools execute directly. Set `UNIFI_CONFIRM_WRITES=true` to require an explicit `confirm: "YES"` argument; otherwise destructive calls return a redacted preview.

## Develop

```bash
npm run dev          # tsx watch
npm test             # unit tests
npm run test:integration   # live read-only (needs UNIFI_API_KEY)
npm run lint
npm run typecheck
npm run codegen      # regenerate src/tools/generated from UniFi docs
npm run inspector    # MCP Inspector
```

## Security

- API key is read from `UNIFI_API_KEY` env only. Never hardcode. `.env` is gitignored.
- Logger redacts known secret patterns from output.
- If your key has ever been pasted into a chat or commit, rotate it.

## License

MIT
```

- [ ] **Step 2: Verifikation, dass `.env` NICHT versehentlich entstanden ist**

```bash
ls -la .env 2>&1 | head -1
```

Falls vorhanden: prüfen, dass `.gitignore` `.env` enthält und nichts geleakt wurde.

- [ ] **Step 3: Git initialisieren**

```bash
cd /Users/manuelguttmann/Projekte/the-real-unifi-mcp
git init
git branch -m main
```

- [ ] **Step 4: Pre-Commit-Check — `.env` darf nicht staged sein**

```bash
git add .
git status --porcelain | grep -E "^A  \.env$" && echo "ABORT — .env staged!" && exit 1
git status --short
```

Expected: kein `A  .env`. Falls doch: `git restore --staged .env`, prüfen ob `.gitignore` korrekt ist.

- [ ] **Step 5: Initial-Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: initial scaffold — UniFi MCP server with hybrid codegen + hand-wrappers

- TypeScript ES-Modules + @modelcontextprotocol/sdk, stdio transport, cloud-only via api.ui.com.
- Three tool layers: unifi_sm_* (Site Manager hand-wrappers), unifi_net_* (Network hand-wrappers),
  unifi_gen_* (codegen output for 100% coverage), plus unifi_raw_request escape hatch.
- Discovery resolves consoleId + both siteIds lazily and caches for process lifetime.
- Optional UNIFI_CONFIRM_WRITES preview/confirm flow for destructive tools.
- Resources: unifi://identity, unifi://hosts. Prompts: audit-firewall, network-health, adoption-status.
- MCPB bundle support, vitest unit + integration tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Verifikation**

```bash
git log --oneline -n 1
git ls-files | grep -E "^\.env$" && echo "FATAL: .env tracked" && exit 1
echo "✓ initial commit clean"
```

Expected: ein Commit, kein `.env` getrackt.

- [ ] **Step 7: Abschluss-Report im CHANGELOG**

`CHANGELOG.md` Edit:

```markdown
# Changelog

## [0.1.0] — YYYY-MM-DD

### Added
- Initial scaffold: TypeScript MCP server (stdio), `@modelcontextprotocol/sdk` 1.x.
- Three tool layers covering Site Manager + Network APIs (100% coverage via codegen + hand-wrappers).
- Generic `unifi_raw_request` escape hatch.
- Discovery (consoleId + siteIds) with env-overrides.
- Optional `UNIFI_CONFIRM_WRITES` preview flow for destructive tools.
- Resources (`unifi://identity`, `unifi://hosts[/id]`) and prompts (audit-firewall, network-health, adoption-status).
- MCPB bundle script.
- Vitest unit + live read-only integration tests.

### Security
- API key only via env (`UNIFI_API_KEY`). Never logged.
- Logger redacts known secret patterns.

### Verified live (read-only)
- Site Manager: hosts, sites, devices.
- Network: devices (~16), clients (~8), networks (~3), WLANs (~3), firewall zones (~6), policies (~65), WANs (2).

### Manual write verification
- Voucher create → delete roundtrip via MCP Inspector on YYYY-MM-DD.
```

- [ ] **Step 8: Optional zweiter Commit für CHANGELOG-Update**

```bash
git add CHANGELOG.md
git commit -m "docs: complete CHANGELOG for 0.1.0"
```

---

## Abschluss

Server-Tooling:
- **stdio MCP-Server**: `node dist/index.js` (oder via MCPB).
- **Tools**: ~10 Site-Manager Hand-Wrapper + ~50 Network Hand-Wrapper + ~140 generierte + 1 Escape-Hatch.
- **Resources**: `unifi://identity`, `unifi://hosts`, `unifi://hosts/{id}`.
- **Prompts**: 3 vorgefertigt.

Verifikation:
- `npm run prebuild` (lint + typecheck + unit-tests) muss grün sein.
- `npm run test:integration` mit Key grün (Plausibilitäts-Anker bestätigt).
- `npm run inspector` zeigt alle Tools, Resource-Read und Prompt-Invocation funktionieren.
- Manueller Voucher-Roundtrip dokumentiert.

Sicherheit:
- API-Key nur in `.env`, niemals committed, niemals geloggt.
- Empfehlung im README: nach Setup rotieren.
