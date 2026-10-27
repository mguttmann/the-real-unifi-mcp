/**
 * Audit M-1: every tool that takes a `body` must accept a call without it
 * (v0.1.2 contract), and write tools must still be held by the confirm guard.
 *
 * The real server runs in-process (dummy key, unreachable API base, discovery
 * overrides). `fetch` is stubbed so no request leaves the process.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Tool } from "@modelcontextprotocol/server";
import { connectInProcess, listLiveTools } from "../contract/liveTools.js";

type Prop = { type?: string; enum?: unknown[]; format?: string };

/** Minimal valid value for a required non-body param. */
function sample(p: Prop): unknown {
  if (Array.isArray(p.enum) && p.enum.length > 0) return p.enum[0];
  if (p.type === "integer" || p.type === "number") return 1;
  if (p.type === "boolean") return true;
  return "00000000-0000-4000-8000-000000000000";
}

/** Params whose generic sample would fail their own validation. */
const OVERRIDES: Record<string, Record<string, unknown>> = {
  unifi_raw_request: { method: "POST", path: "/v1/hosts" },
  // Bulk delete refuses without a filter (N-7); `filter` replaces `body.filter`.
  unifi_net_delete_vouchers: { filter: "expired.eq(true)" },
};

function argsWithoutBody(tool: Tool): Record<string, unknown> {
  const props = (tool.inputSchema.properties ?? {}) as Record<string, Prop>;
  const args: Record<string, unknown> = { ...OVERRIDES[tool.name] };
  for (const name of tool.inputSchema.required ?? []) {
    if (name === "body" || name === "confirm" || name in args) continue;
    args[name] = sample(props[name] ?? {});
  }
  return args;
}

function firstText(res: unknown): string {
  return (res as { content: Array<{ text?: string }> }).content[0]?.text ?? "";
}

let bodyTools: Tool[];

beforeAll(async () => {
  const { tools } = await listLiveTools();
  bodyTools = tools.filter((t) => Object.hasOwn(t.inputSchema.properties ?? {}, "body"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch() {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("body is optional at call time on every body tool (audit M-1)", () => {
  it("finds the body tools and none lists body as required", () => {
    // 42 restored by M-1 plus three whose body was always optional
    // (unifi_raw_request, unifi_net_port_action, unifi_net_delete_vouchers).
    expect(bodyTools).toHaveLength(45);
    expect(bodyTools.filter((t) => t.inputSchema.required?.includes("body"))).toEqual([]);
  });

  it("accepts each call without body; write tools return the confirm preview and send nothing", async () => {
    const fetchMock = stubFetch();
    const { client, close } = await connectInProcess();
    const failures: string[] = [];
    let guarded = 0;
    try {
      for (const tool of bodyTools) {
        const res = await client.callTool({ name: tool.name, arguments: argsWithoutBody(tool) });
        const text = firstText(res);
        if (res.isError) {
          failures.push(`${tool.name}: ${text}`);
          continue;
        }
        const hasConfirm = Object.hasOwn(tool.inputSchema.properties ?? {}, "confirm");
        if (hasConfirm) {
          guarded++;
          if (!(JSON.parse(text) as { data?: { preview?: unknown } }).data?.preview) {
            failures.push(`${tool.name}: no confirm preview`);
          }
        }
      }
    } finally {
      await close();
    }
    expect(failures).toEqual([]);
    // Only the ungated read query (unifi_sm_query_isp_metrics) reaches fetch.
    expect(guarded).toBe(44);
    expect(fetchMock).toHaveBeenCalledTimes(bodyTools.length - guarded);
  });

  it("executes a confirmed write without body and sends no request body", async () => {
    const fetchMock = stubFetch();
    const { client, close } = await connectInProcess();
    try {
      for (const name of ["unifi_gen_createfirewallpolicy", "unifi_net_create_firewall_zone"]) {
        const res = await client.callTool({ name, arguments: { confirm: "YES" } });
        expect(res.isError, firstText(res)).toBeFalsy();
      }
    } finally {
      await close();
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls as unknown as Array<[string, RequestInit]>) {
      expect(call[1].method).toBe("POST");
      expect(call[1].body).toBeUndefined();
    }
  });
});
