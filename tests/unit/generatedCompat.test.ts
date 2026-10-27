/**
 * Regenerated tools must not reject input that 0.2.1 accepted (codegen refresh
 * 0.3.0, N-37, N-38, N-63).
 *
 * tests/contract/generated-input-0.2.1.json is the tools/list inputSchema of
 * every `unifi_gen_*` tool as published in 0.2.1 (frozen, never regenerate).
 * Params other than `body` must keep their JSON schema (descriptions aside);
 * `body` may gain a typed branch but must still accept any value, unchanged.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Tool } from "@modelcontextprotocol/server";
import { z } from "zod";
import { connectInProcess, listLiveTools } from "../contract/liveTools.js";

type JsonSchema = {
  properties?: Record<string, Record<string, unknown>>;
  required?: string[];
};

const FROZEN = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../contract/generated-input-0.2.1.json", import.meta.url)),
    "utf8",
  ),
) as Record<string, JsonSchema>;

function withoutDescription(s: Record<string, unknown> | undefined): unknown {
  if (!s) return s;
  const { description: _d, ...rest } = s;
  return rest;
}

let live: Map<string, Tool>;

beforeAll(async () => {
  const { tools } = await listLiveTools();
  live = new Map(tools.map((t) => [t.name, t]));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generated tools keep the 0.2.1 input contract", () => {
  it("the frozen file covers the 80 generated tools of 0.2.1, and all still exist", () => {
    expect(Object.keys(FROZEN)).toHaveLength(80);
    expect(Object.keys(FROZEN).filter((n) => !live.has(n))).toEqual([]);
  });

  it("required lists and non-body param schemas are unchanged (descriptions aside)", () => {
    const diffs: string[] = [];
    for (const [name, old] of Object.entries(FROZEN)) {
      const now = live.get(name)!.inputSchema as JsonSchema;
      const sorted = (r: string[] | undefined) => JSON.stringify([...(r ?? [])].sort());
      if (sorted(now.required) !== sorted(old.required)) diffs.push(`${name}.required`);
      const oldProps = old.properties ?? {};
      const nowProps = now.properties ?? {};
      for (const [p, s] of Object.entries(oldProps)) {
        if (!(p in nowProps)) diffs.push(`${name}.${p} removed`);
        else if (
          p !== "body" &&
          JSON.stringify(withoutDescription(nowProps[p])) !== JSON.stringify(withoutDescription(s))
        )
          diffs.push(`${name}.${p}: ${JSON.stringify(s)} -> ${JSON.stringify(nowProps[p])}`);
      }
      for (const p of Object.keys(nowProps)) if (!(p in oldProps)) diffs.push(`${name}.${p} added`);
    }
    expect(diffs).toEqual([]);
  });

  it("every body schema still admits any JSON value (anyOf with an empty schema)", () => {
    const narrow: string[] = [];
    for (const [name, old] of Object.entries(FROZEN)) {
      if (!old.properties?.body) continue;
      const body = (live.get(name)!.inputSchema as JsonSchema).properties!.body!;
      const anyOf = body.anyOf as unknown[] | undefined;
      const admitsAll =
        Object.keys(withoutDescription(body) as object).length === 0 ||
        (Array.isArray(anyOf) && anyOf.some((b) => JSON.stringify(b) === "{}"));
      if (!admitsAll) narrow.push(name);
    }
    expect(narrow).toEqual([]);
  });
});

/** Minimal valid value for a required non-body param. */
function sample(p: { type?: string; enum?: unknown[] }): unknown {
  if (Array.isArray(p.enum) && p.enum.length > 0) return p.enum[0];
  if (p.type === "integer" || p.type === "number") return 1;
  if (p.type === "boolean") return true;
  return "00000000-0000-4000-8000-000000000000";
}

describe("bodies that 0.2.1 accepted reach the confirm preview unchanged", () => {
  const bodies: unknown[] = [
    { arbitrary: 1, nested: { list: [1, "x", null] } },
    "a string",
    42,
    [1, 2, 3],
    null,
  ];

  it("every generated write tool with a body", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { client, close } = await connectInProcess();
    const failures: string[] = [];
    try {
      for (const [name, old] of Object.entries(FROZEN)) {
        if (!old.properties?.body) continue;
        const args: Record<string, unknown> = {};
        for (const r of old.required ?? []) args[r] = sample(old.properties[r] ?? {});
        for (const body of bodies) {
          const res = await client.callTool({ name, arguments: { ...args, body } });
          const text = (res.content as Array<{ text: string }>)[0]?.text ?? "";
          if (res.isError) {
            failures.push(`${name} ${JSON.stringify(body)}: ${text}`);
            continue;
          }
          const sent = (JSON.parse(text) as { data: { preview: { body: unknown } } }).data.preview
            .body;
          if (JSON.stringify(sent) !== JSON.stringify(body))
            failures.push(`${name} ${JSON.stringify(body)} -> ${JSON.stringify(sent)}`);
        }
      }
    } finally {
      await close();
    }
    expect(failures).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("a body that matches the typed branch is passed through unchanged", () => {
  it("unifi_gen_createfirewallzone keeps unknown keys", async () => {
    let shape: z.ZodType | undefined;
    const { register } = await import("../../src/tools/generated/unifi_gen_createfirewallzone.js");
    const fakeServer = {
      registerTool: (_n: string, def: { inputSchema: z.ZodType }) => {
        shape = def.inputSchema;
      },
    };
    register(fakeServer as never, {} as never);
    const body = {
      name: "Guests",
      networkIds: ["00000000-0000-4000-8000-000000000000"],
      vendorFieldFromTheFuture: { a: [1] },
    };
    const bodySchema = (shape as z.ZodObject).shape.body as z.ZodType;
    // The value matches the typed branch (not only the z.unknown() fallback) ...
    const typedBranch = (
      (bodySchema as z.ZodOptional).unwrap() as z.ZodUnion<[z.ZodType, z.ZodType]>
    ).options[0];
    expect(typedBranch.safeParse(body).success).toBe(true);
    // ... and comes out deep-equal, unknown keys included.
    expect(shape!.parse({ body })).toEqual({ body });
  });
});
