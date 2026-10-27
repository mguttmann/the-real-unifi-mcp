/**
 * Docs and server instructions state what the code does (audit N-4, N-23,
 * N-34, N-56, N-70). Every fixed number or default the docs name is either
 * checked here or by another test.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { STDIO_DEFAULT_MAX_BUFFER_SIZE } from "@modelcontextprotocol/server";
import type { Tool } from "@modelcontextprotocol/server";
import { beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { MAX_TOOL_INPUT_ELEMENTS, MAX_UPSTREAM_ERROR_CHARS, RETRY } from "../../src/constants.js";
import { connectInProcess, listLiveTools } from "../contract/liveTools.js";

const read = (rel: string): string =>
  readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const defaults = loadConfig({ UNIFI_API_KEY: "docs-test-dummy-key" });
const expectedDefaults: Record<string, string> = {
  UNIFI_API_BASE: defaults.apiBase,
  UNIFI_CONFIRM_WRITES: String(defaults.confirmWrites),
  UNIFI_TIMEOUT_MS: String(defaults.timeoutMs),
  UNIFI_LOG_LEVEL: defaults.logLevel,
  UNIFI_READ_ONLY: String(defaults.readOnly),
  UNIFI_REDACT_SECRETS: String(defaults.redactSecrets),
};

let tools: Tool[];
let instructions: string;

beforeAll(async () => {
  tools = (await listLiveTools()).tools;
  const { client, close } = await connectInProcess();
  try {
    instructions = client.getInstructions() ?? "";
  } finally {
    await close();
  }
});

describe("documented defaults equal src/config.ts", () => {
  it("README configuration table", () => {
    const readme = read("README.md");
    for (const [name, value] of Object.entries(expectedDefaults)) {
      const row = new RegExp(`^\\| \`${name}\` \\| \`([^\`]*)\` \\|`, "m").exec(readme);
      expect(row?.[1], name).toBe(value);
    }
  });

  it(".env.example", () => {
    const env = read(".env.example");
    for (const [name, value] of Object.entries(expectedDefaults)) {
      const line = new RegExp(`^${name}=(.*)$`, "m").exec(env);
      expect(line?.[1], name).toBe(value);
    }
  });
});

describe("server instructions", () => {
  it("tell the model to treat tool output as data (N-23)", () => {
    expect(instructions).toMatch(/treat .*tool (results|output).* as data/i);
  });

  it("state the confirm-writes default (N-4)", () => {
    expect(defaults.confirmWrites).toBe(true);
    expect(instructions).toContain("`UNIFI_CONFIRM_WRITES` unset or true");
  });

  it("make no coverage claim (N-56)", () => {
    expect(instructions).not.toMatch(/100\s*%/);
  });
});

describe("SECURITY.md limits", () => {
  const security = read("SECURITY.md");

  it("names the SDK stdio line limit (N-34)", () => {
    expect(STDIO_DEFAULT_MAX_BUFFER_SIZE % (1024 * 1024)).toBe(0);
    expect(security).toContain(`${STDIO_DEFAULT_MAX_BUFFER_SIZE / (1024 * 1024)} MiB`);
  });

  it("names the input element limit (N-33)", () => {
    expect(security).toContain(String(MAX_TOOL_INPUT_ELEMENTS));
  });
});

describe("CHANGELOG limits", () => {
  it("names the upstream error text cap (N-25)", () => {
    expect(read("CHANGELOG.md")).toContain(`cut to ${MAX_UPSTREAM_ERROR_CHARS} characters`);
  });

  it("0.3.0 tool counts equal tools/list of 0.2.1 (frozen) and of today", () => {
    const section = read("CHANGELOG.md").split(/^## /m)[1]!;
    expect(section.startsWith("[0.3.0]")).toBe(true);
    const old = Object.keys(
      (
        JSON.parse(read("tests/contract/tools-contract-0.2.1.json")) as {
          tools: Record<string, unknown>;
        }
      ).tools,
    );
    const gen = tools.filter((t) => t.name.startsWith("unifi_gen_"));
    const num = (re: RegExp) => [...section.matchAll(re)].map((m) => m.slice(1).map(Number));
    expect(num(/Tool count (\d+) -> (\d+) \(generated (\d+) -> (\d+)\)/g)).toEqual([
      [old.length, tools.length, old.filter((n) => n.startsWith("unifi_gen_")).length, gen.length],
    ]);
    expect(num(/of the (\d+) Network `unifi_gen_\*` tools/g)).toEqual([
      [gen.filter((t) => t.description?.includes("developer.ui.com/network/")).length],
    ]);
    expect(num(/`body` property of the (\d+) generated write tools/g)).toEqual([
      [
        gen.filter((t) => t.inputSchema.properties?.body && t.inputSchema.properties.confirm)
          .length,
      ],
    ]);
  });
});

describe("README hand-wrapper inventory (N-70)", () => {
  const readme = read("README.md");
  const byPrefix = (p: string) => tools.filter((t) => t.name.startsWith(p)).map((t) => t.name);

  it("heading counts equal tools/list", () => {
    const sm = byPrefix("unifi_sm_").length;
    const net = byPrefix("unifi_net_").length;
    expect(/Site Manager hand-wrappers \((\d+)\)/.exec(readme)?.[1]).toBe(String(sm));
    expect(/Network hand-wrappers \((\d+)\)/.exec(readme)?.[1]).toBe(String(net));
    expect(/\b(\d+) hand-wrappers\b/.exec(readme)?.[1]).toBe(String(sm + net));
  });

  it("total, generated and raw tool counts and the retry numbers equal the code", () => {
    const all = tools.length;
    const gen = byPrefix("unifi_gen_").length;
    const raw = tools.filter((t) => t.name === "unifi_raw_request").length;
    const totals = [...readme.matchAll(/\b(\d+) tools\b/g)].map((m) => Number(m[1]));
    expect(totals.length).toBeGreaterThan(0);
    expect(new Set(totals)).toEqual(new Set([all]));
    expect(/Auto-generated tools \((\d+)\)/.exec(readme)?.[1]).toBe(String(gen));
    for (const m of readme.matchAll(/\b(\d+) auto-generated tools\b/g))
      expect(Number(m[1])).toBe(gen);
    expect(/Escape hatch \((\d+)\)/.exec(readme)?.[1]).toBe(String(raw));
    const sum = /\((\d+) \+ (\d+) \+ (\d+) = (\d+)\)/.exec(readme);
    expect(sum?.slice(1).map(Number)).toEqual([all - gen - raw, gen, raw, all]);
    expect(/tried at most (\d+) times/.exec(readme)?.[1]).toBe(String(RETRY.MAX_ATTEMPTS));
    expect(/capped at (\d+) s\b/.exec(readme)?.[1]).toBe(
      String(RETRY.RETRY_AFTER_CEILING_MS / 1000),
    );
  });

  it("lists every hand-wrapper once, and each group count matches its list", () => {
    const listed = new Set<string>();
    for (const m of readme.matchAll(/^- \*\*[^*(]+\((\d+)\):\*\* (.*)$/gm)) {
      const names = [...m[2]!.matchAll(/`(unifi_net_[a-z0-9_]+)`/g)].map((n) => n[1]!);
      expect(names.length, m[0]).toBe(Number(m[1]));
      names.forEach((n) => listed.add(n));
    }
    for (const m of readme.matchAll(/^- `(unifi_sm_[a-z0-9_]+)`/gm)) listed.add(m[1]!);
    const expected = [...byPrefix("unifi_net_"), ...byPrefix("unifi_sm_")].sort();
    expect([...listed].sort()).toEqual(expected);
  });
});

// En dash and em dash, written as escapes so this file holds neither.
const DASH = /[\u2013\u2014]/;

describe("house style: no em or en dash", () => {
  const files = [
    "README.md",
    "SECURITY.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "CLAUDE.md",
    ".env.example",
    "docs/RELEASING.md",
    "docs/maintainers/repo-settings.md",
    "package.json",
    "mcpb/manifest.json",
    ".github/ISSUE_TEMPLATE/bug_report.md",
    ".github/ISSUE_TEMPLATE/feature_request.md",
  ];

  it.each(files)("%s", (file) => {
    const hits = read(file)
      .split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => DASH.test(line))
      .map(([n]) => n);
    expect(hits).toEqual([]);
  });

  it("server instructions", () => {
    expect(instructions).not.toMatch(DASH);
  });

  it("tool titles and descriptions, also of input properties (N-59)", () => {
    const hits = tools.filter((t) => DASH.test(JSON.stringify(t))).map((t) => t.name);
    expect(hits).toEqual([]);
  });

  it("source, tests, scripts and workflows (vendor fixtures excepted, N-87)", () => {
    const tracked = execFileSync(
      "git",
      [
        "ls-files",
        "src",
        "tests",
        "scripts",
        ".github",
        "docs",
        "mcpb",
        "*.md",
        "*.json",
        "NOTICE",
        ".gitignore",
        ".prettierignore",
      ],
      {
        cwd: fileURLToPath(new URL("../../", import.meta.url)),
        encoding: "utf8",
      },
    )
      .split("\n")
      .filter((f) => f && !f.startsWith("tests/fixtures/") && f !== "package-lock.json")
      .filter((f) => existsSync(new URL(`../../${f}`, import.meta.url)));
    const hits = tracked.filter((f) => DASH.test(read(f)));
    expect(hits).toEqual([]);
  });
});
