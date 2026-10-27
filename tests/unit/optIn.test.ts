/**
 * Opt-in features of 0.3.0, off by default (0.2.1 behaviour):
 * UNIFI_READ_ONLY and `dry_run` (audit N-23), UNIFI_REDACT_SECRETS (N-22),
 * UNIFI_MAX_RESULT_BYTES (N-32; a default cap since 0.4.0, see
 * resultSize.test.ts). `fetch` is a fake; nothing leaves the process.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Tool } from "@modelcontextprotocol/server";
import { loadConfig } from "../../src/config.js";
import { DEFAULT_MAX_RESULT_BYTES } from "../../src/constants.js";
import { connectInProcess, listLiveTools } from "../contract/liveTools.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function text(res: unknown): string {
  return (res as { content: Array<{ text?: string }> }).content[0]?.text ?? "";
}

function stubFetch(payload: unknown = { data: [] }) {
  const f = vi.fn(
    async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", f);
  return f;
}

type Prop = { type?: string; enum?: unknown[]; items?: Prop };
function sample(p: Prop): unknown {
  if (Array.isArray(p.enum) && p.enum.length > 0) return p.enum[0];
  if (p.type === "integer" || p.type === "number") return 1;
  if (p.type === "boolean") return true;
  if (p.type === "array") return ["aa:bb:cc:dd:ee:ff"];
  return "00000000-0000-4000-8000-000000000000";
}

/** Minimal valid arguments plus overrides. */
function argsFor(t: Tool, extra: Record<string, unknown>): Record<string, unknown> {
  const props = (t.inputSchema.properties ?? {}) as Record<string, Prop>;
  const args: Record<string, unknown> = {};
  for (const k of t.inputSchema.required ?? []) args[k] = sample(props[k] ?? {});
  if (t.name === "unifi_raw_request") Object.assign(args, { method: "POST", path: "/v1/x" });
  if (t.name === "unifi_net_delete_vouchers") args.filter = "x";
  return { ...args, ...extra };
}

let writeTools: Tool[];
let readTools: Tool[];

beforeAll(async () => {
  const { tools } = await listLiveTools();
  writeTools = tools.filter((t) => "confirm" in (t.inputSchema.properties ?? {}));
  readTools = tools.filter((t) => !("confirm" in (t.inputSchema.properties ?? {})));
});

describe("config of the opt-in variables", () => {
  const base = { UNIFI_API_KEY: "k" };

  it("defaults keep 0.2.1 behaviour (the result cap has a default since 0.4.0)", () => {
    const cfg = loadConfig(base);
    expect(cfg.readOnly).toBe(false);
    expect(cfg.redactSecrets).toBe(false);
    expect(cfg.maxResultBytes).toBe(DEFAULT_MAX_RESULT_BYTES);
  });

  it("parses on and off values; an unknown value turns the switch on and warns", () => {
    for (const [name, key] of [
      ["UNIFI_READ_ONLY", "readOnly"],
      ["UNIFI_REDACT_SECRETS", "redactSecrets"],
    ] as const) {
      for (const v of ["true", "1", "yes", "on", " ON "])
        expect(loadConfig({ ...base, [name]: v })[key], `${name}=${v}`).toBe(true);
      for (const v of ["false", "0", "no", "off", ""])
        expect(loadConfig({ ...base, [name]: v })[key], `${name}=${v}`).toBe(false);
      const warnings: string[] = [];
      expect(loadConfig({ ...base, [name]: "maybe" }, (w) => warnings.push(w))[key]).toBe(true);
      expect(warnings.join()).toContain(name);
    }
  });

  it("UNIFI_MAX_RESULT_BYTES takes a positive integer or 0/off/none and refuses anything else", () => {
    expect(loadConfig({ ...base, UNIFI_MAX_RESULT_BYTES: "4096" }).maxResultBytes).toBe(4096);
    expect(loadConfig({ ...base, UNIFI_MAX_RESULT_BYTES: " " }).maxResultBytes).toBe(
      DEFAULT_MAX_RESULT_BYTES,
    );
    expect(loadConfig({ ...base, UNIFI_MAX_RESULT_BYTES: "0" }).maxResultBytes).toBe(0);
    for (const v of ["-1", "1.5", "abc"])
      expect(() => loadConfig({ ...base, UNIFI_MAX_RESULT_BYTES: v }), v).toThrow(
        /UNIFI_MAX_RESULT_BYTES/,
      );
  });
});

describe("UNIFI_READ_ONLY (N-23)", () => {
  it("every write tool refuses without a request, even with confirm YES", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess({ readOnly: true });
    const wrong: string[] = [];
    try {
      for (const t of writeTools) {
        const res = await client.callTool({
          name: t.name,
          arguments: argsFor(t, { confirm: "YES" }),
        });
        if (t.name === "unifi_net_block_client" || t.name === "unifi_net_unblock_client") {
          if (!res.isError) wrong.push(`${t.name}: not an error`);
          continue;
        }
        const payload = JSON.parse(text(res)) as { details?: { code?: string } };
        if (!res.isError || payload.details?.code !== "READ_ONLY")
          wrong.push(`${t.name}: ${text(res).slice(0, 160)}`);
      }
    } finally {
      await close();
    }
    expect(wrong).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    expect(writeTools.length).toBeGreaterThan(60);
  });

  it("read tools and a raw GET still run", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess({ readOnly: true });
    try {
      const a = await client.callTool({ name: "unifi_net_list_devices", arguments: {} });
      const b = await client.callTool({
        name: "unifi_raw_request",
        arguments: { method: "GET", path: "/v1/hosts" },
      });
      expect(a.isError).toBeFalsy();
      expect(b.isError).toBeFalsy();
    } finally {
      await close();
    }
    expect(f).toHaveBeenCalledTimes(2);
    expect(readTools.length).toBeGreaterThan(80);
  });
});

describe("dry_run (N-23)", () => {
  it("every write tool returns the preview and sends nothing, also with confirm YES and confirmation off", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess({ confirmWrites: false });
    const wrong: string[] = [];
    try {
      for (const t of writeTools) {
        if (t.name === "unifi_net_block_client" || t.name === "unifi_net_unblock_client") continue;
        const res = await client.callTool({
          name: t.name,
          arguments: argsFor(t, { confirm: "YES", dry_run: true }),
        });
        const payload = JSON.parse(text(res)) as {
          data?: { preview?: { tool?: string }; hint?: string };
        };
        if (
          res.isError ||
          payload.data?.preview?.tool !== t.name ||
          !/dry_run/.test(payload.data.hint ?? "")
        )
          wrong.push(`${t.name}: ${text(res).slice(0, 160)}`);
      }
    } finally {
      await close();
    }
    expect(wrong).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("a raw GET with dry_run returns the preview", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({
        name: "unifi_raw_request",
        arguments: { method: "GET", path: "/v1/hosts", query: { a: "1" }, dry_run: true },
      });
      expect(JSON.parse(text(res)).data.preview.url).toBe("/v1/hosts?a=1");
    } finally {
      await close();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("a dry_run value that is not a boolean is accepted and ignored, as 0.2.1 did", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({
        name: "unifi_net_reboot_device",
        arguments: { deviceId: "D1", confirm: "YES", dry_run: "yes" },
      });
      expect(res.isError, text(res)).toBeFalsy();
    } finally {
      await close();
    }
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("UNIFI_REDACT_SECRETS (N-22)", () => {
  const payload = {
    data: [{ name: "Home", passphrase: "hunter2", presharedKeys: ["k1"], nested: { psk: "p" } }],
    nextToken: "page-2",
  };

  it("off (default): read results are returned unchanged", async () => {
    stubFetch(payload);
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({ name: "unifi_net_list_wifi", arguments: {} });
      expect(JSON.parse(text(res)).data).toEqual(payload);
    } finally {
      await close();
    }
  });

  it("on: secret fields are masked like in the confirm preview, paging tokens kept", async () => {
    stubFetch(payload);
    const { client, close } = await connectInProcess({ redactSecrets: true });
    try {
      for (const name of ["unifi_net_list_wifi", "unifi_gen_getwifibroadcastpage"]) {
        const res = await client.callTool({ name, arguments: {} });
        expect(JSON.parse(text(res)).data, name).toEqual({
          data: [
            {
              name: "Home",
              passphrase: "(redacted)",
              presharedKeys: "(redacted)",
              nested: { psk: "(redacted)" },
            },
          ],
          nextToken: "page-2",
        });
      }
    } finally {
      await close();
    }
  });
});

describe("UNIFI_MAX_RESULT_BYTES (N-32)", () => {
  const big = { data: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `device-${i}` })) };

  it("unset (default cap of 0.4.0): a result below the cap is complete", async () => {
    stubFetch(big);
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({ name: "unifi_net_list_devices", arguments: {} });
      expect(JSON.parse(text(res)).data).toEqual(big);
    } finally {
      await close();
    }
  });

  it("set: a longer result is cut with a marker that names the paging params", async () => {
    stubFetch(big);
    const { client, close } = await connectInProcess({ maxResultBytes: 1000 });
    try {
      const res = await client.callTool({ name: "unifi_net_list_devices", arguments: {} });
      const t = text(res);
      const [kept, marker] = t.split("\n... (truncated");
      expect(Buffer.byteLength(kept!)).toBeLessThanOrEqual(1000);
      expect(marker).toMatch(/UNIFI_MAX_RESULT_BYTES is 1000/);
      expect(marker).toMatch(/offset/);
      expect(res.isError).toBeFalsy();
    } finally {
      await close();
    }
  });

  it("set: a shorter result is unchanged", async () => {
    stubFetch({ data: [] });
    const { client, close } = await connectInProcess({ maxResultBytes: 1000 });
    try {
      const res = await client.callTool({ name: "unifi_net_list_devices", arguments: {} });
      expect(JSON.parse(text(res)).data).toEqual({ data: [] });
    } finally {
      await close();
    }
  });
});
