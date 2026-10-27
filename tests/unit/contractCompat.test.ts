/**
 * Every tool of 0.2.1 keeps accepting what 0.2.1 accepted (plan 0.3.0, done
 * criteria 2 and 3).
 *
 * tests/contract/tools-contract-0.2.1.json is the tools/list of 0.2.1
 * (inputSchema and annotations of all 167 tools), dumped from main 32c12bb
 * and frozen: never regenerate it. tests/contract/tools-contract.json is
 * edited by hand and can follow a narrowing; this file cannot.
 *
 * Checked here for every 0.2.1 tool: still listed, no new required param, no
 * property removed, defaults unchanged, the param schemas of hand-written
 * tools unchanged (descriptions aside), every added property accepts any
 * value, annotations unchanged except the changes named in CHANGELOG 0.3.0,
 * and a replay: a minimal valid call plus an unknown key plus a value of the
 * wrong type for every added property is accepted and sends exactly what the
 * minimal call sends. Generated tools: params and bodies are also checked in
 * generatedCompat.test.ts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Tool } from "@modelcontextprotocol/server";
import { connectInProcess, listLiveTools } from "../contract/liveTools.js";

type Prop = Record<string, unknown>;
interface JsonSchema {
  properties?: Record<string, Prop>;
  required?: string[];
}
interface Frozen {
  serverVersion: string;
  tools: Record<string, { inputSchema: JsonSchema; annotations: Record<string, unknown> }>;
}

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const FROZEN = JSON.parse(read("../contract/tools-contract-0.2.1.json")) as Frozen;
const CHANGELOG = read("../../CHANGELOG.md");
const NAMES = Object.keys(FROZEN.tools);

/** Annotation changes of 0.3.0 (N-27), each listed in CHANGELOG 0.3.0. */
const ANNOTATION_CHANGES: Record<string, Record<string, unknown>> = {
  unifi_gen_queryispmetrics: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  unifi_net_block_client: { idempotentHint: true },
  unifi_net_unblock_client: { idempotentHint: true },
};

let live: Map<string, Tool>;
const schemaOf = (name: string) => live.get(name)!.inputSchema as JsonSchema;
const props = (s: JsonSchema) => s.properties ?? {};

function withoutDescription(s: Prop | undefined): unknown {
  if (!s) return s;
  const { description: _d, ...rest } = s;
  return rest;
}

/** Properties a 0.3.0 tool has that the same tool did not have in 0.2.1. */
function added(name: string): string[] {
  const old = props(FROZEN.tools[name]!.inputSchema);
  return Object.keys(props(schemaOf(name))).filter((p) => !(p in old));
}

beforeAll(async () => {
  const { tools } = await listLiveTools();
  live = new Map(tools.map((t) => [t.name, t]));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the frozen 0.2.1 tool list", () => {
  it("is the tools/list of 0.2.1 with 167 tools, all still listed", () => {
    expect(FROZEN.serverVersion).toBe("0.2.1");
    expect(NAMES).toHaveLength(167);
    expect(NAMES.filter((n) => !live.has(n))).toEqual([]);
    expect(live.size).toBeGreaterThanOrEqual(NAMES.length);
  });
});

describe("schemas only widen", () => {
  it("no new required param, no property removed, no default changed", () => {
    const diffs: string[] = [];
    for (const name of NAMES) {
      const old = FROZEN.tools[name]!.inputSchema;
      const now = schemaOf(name);
      for (const r of now.required ?? [])
        if (!(old.required ?? []).includes(r)) diffs.push(`${name}: ${r} now required`);
      for (const [p, s] of Object.entries(props(old))) {
        const n = props(now)[p];
        if (!n) diffs.push(`${name}.${p} removed`);
        else if (JSON.stringify(n.default) !== JSON.stringify(s.default))
          diffs.push(
            `${name}.${p} default ${JSON.stringify(s.default)} -> ${JSON.stringify(n.default)}`,
          );
      }
    }
    expect(diffs).toEqual([]);
  });

  it("param schemas of hand-written tools are unchanged (descriptions aside)", () => {
    const diffs: string[] = [];
    for (const name of NAMES.filter((n) => !n.startsWith("unifi_gen_"))) {
      const now = props(schemaOf(name));
      for (const [p, s] of Object.entries(props(FROZEN.tools[name]!.inputSchema))) {
        if (
          now[p] &&
          JSON.stringify(withoutDescription(now[p])) !== JSON.stringify(withoutDescription(s))
        )
          diffs.push(`${name}.${p}: ${JSON.stringify(s)} -> ${JSON.stringify(now[p])}`);
      }
    }
    expect(diffs).toEqual([]);
  });

  it("every added property accepts any value (anyOf with an empty schema)", () => {
    const narrow: string[] = [];
    let count = 0;
    for (const name of NAMES) {
      for (const p of added(name)) {
        count++;
        const s = props(schemaOf(name))[p]!;
        const anyOf = s.anyOf as unknown[] | undefined;
        if (!(Array.isArray(anyOf) && anyOf.some((b) => JSON.stringify(b) === "{}")))
          narrow.push(`${name}.${p}: ${JSON.stringify(s)}`);
      }
    }
    expect(count).toBeGreaterThan(0);
    expect(narrow).toEqual([]);
  });

  it("annotations are unchanged except the listed changes", () => {
    const diffs: string[] = [];
    for (const name of NAMES) {
      const want = { ...FROZEN.tools[name]!.annotations, ...ANNOTATION_CHANGES[name] };
      const got = live.get(name)!.annotations ?? {};
      for (const k of new Set([...Object.keys(want), ...Object.keys(got)]))
        if ((got as Record<string, unknown>)[k] !== want[k])
          diffs.push(
            `${name}.${k}: ${String(want[k])} -> ${String((got as Record<string, unknown>)[k])}`,
          );
    }
    expect(diffs).toEqual([]);
    for (const name of Object.keys(ANNOTATION_CHANGES)) expect(CHANGELOG).toContain(`\`${name}\``);
  });
});

/** A value that passes the 0.2.1 schema of a required param. */
function sample(name: string, param: string, s: Prop): unknown {
  if (name === "unifi_raw_request" && param === "path") return "/v1/hosts";
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0];
  if ("const" in s) return s.const;
  if (s.type === "integer" || s.type === "number") return 1;
  if (s.type === "boolean") return true;
  if (s.type === "array") return ["00000000-0000-4000-8000-000000000000"];
  if (s.type === "object") return {};
  return "00000000-0000-4000-8000-000000000000";
}

/** Optional params a minimal call needs to get past a 0.2.1 call-time check. */
const MINIMAL_EXTRA: Record<string, Record<string, unknown>> = {
  unifi_net_delete_vouchers: { filter: "expires.lt(1)" },
};

/** Tools that refuse every call, as in 0.2.1 (no such API action). */
const REFUSED_IN_021 = new Set(["unifi_net_block_client", "unifi_net_unblock_client"]);

interface Outcome {
  isError: boolean;
  text: string;
  requests: string[];
}

describe("0.2.1 calls replay unchanged", () => {
  it("every 0.2.1 tool: a minimal call, plus an unknown key and wrong-typed new params, sends the same", async () => {
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        requests.push(
          `${String(init.method)} ${url} ${typeof init.body === "string" ? init.body : "-"}`,
        );
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const { client, close } = await connectInProcess();
    const call = async (name: string, args: Record<string, unknown>): Promise<Outcome> => {
      requests.length = 0;
      const res = await client.callTool({ name, arguments: args });
      const text = (res.content as Array<{ text?: string }>)[0]?.text ?? "";
      return { isError: res.isError === true, text, requests: [...requests] };
    };
    const failures: string[] = [];
    let withAdded = 0;
    try {
      for (const name of NAMES) {
        const old = FROZEN.tools[name]!.inputSchema;
        const minimal: Record<string, unknown> = { ...MINIMAL_EXTRA[name] };
        for (const r of old.required ?? []) minimal[r] = sample(name, r, props(old)[r] ?? {});
        const extra: Record<string, unknown> = { ...minimal, notAParamIn021: { x: [1] } };
        const newProps = added(name);
        if (newProps.length > 0) withAdded++;
        for (const p of newProps) extra[p] = { wrongType: true };

        const a = await call(name, minimal);
        const b = await call(name, extra);
        const refused = REFUSED_IN_021.has(name);
        if (a.isError !== refused) failures.push(`${name} minimal: ${a.text}`);
        if (b.isError !== refused) failures.push(`${name} with extras: ${b.text}`);
        if (JSON.stringify(a.requests) !== JSON.stringify(b.requests))
          failures.push(`${name}: ${JSON.stringify(a.requests)} vs ${JSON.stringify(b.requests)}`);
        // Write tools answer with the confirm preview; it must not change either.
        if ("confirm" in props(old) && a.text !== b.text)
          failures.push(`${name} preview: ${a.text} vs ${b.text}`);
      }
    } finally {
      await close();
    }
    expect(failures).toEqual([]);
    expect(withAdded).toBeGreaterThan(0);
  });
});
