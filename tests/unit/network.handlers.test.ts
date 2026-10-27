/**
 * Hand-written network tools (`unifi_net_*`) against the vendor spec
 * (audit M-3 to M-7, N-1, N-2, N-6, N-7, N-45).
 *
 * The real server runs in-process (dummy key, unreachable API base, discovery
 * overrides). `fetch` is stubbed, so every request is recorded and none leaves
 * the process.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Tool } from "@modelcontextprotocol/server";
import { connectInProcess, listLiveTools, OFFLINE_CONFIG } from "../contract/liveTools.js";

const FIXTURE = fileURLToPath(
  new URL("../fixtures/openapi/network_v11.0.97.json", import.meta.url),
);
const PREFIX = `/v1/connector/consoles/${OFFLINE_CONFIG.consoleIdOverride}/proxy/network/integration`;
const SITE = OFFLINE_CONFIG.networkSiteIdOverride as string;

/** Path templates of the vendor Network API (OpenAPI v11.0.97), e.g. `/v1/sites/{siteId}/devices`. */
function vendorTemplates(): string[] {
  return Object.keys((JSON.parse(readFileSync(FIXTURE, "utf8")) as { paths: object }).paths);
}

function templateRegex(t: string): RegExp {
  const body = t.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^}]+\}/g, "[^/]+");
  return new RegExp(`^${body}$`);
}

interface Recorded {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
}

let calls: Recorded[] = [];

function stubFetch(status = 200) {
  calls = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const u = new URL(url);
    calls.push({
      method: String(init.method),
      path: u.pathname.startsWith(PREFIX) ? u.pathname.slice(PREFIX.length) : u.pathname,
      query: Object.fromEntries(u.searchParams),
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    return new Response(JSON.stringify(status === 200 ? { data: [] } : { message: "nope" }), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function firstText(res: unknown): string {
  return (res as { content: Array<{ text?: string }> }).content[0]?.text ?? "";
}

type Prop = { type?: string; enum?: unknown[]; items?: Prop };

function sample(p: Prop): unknown {
  if (Array.isArray(p.enum) && p.enum.length > 0) return p.enum[0];
  if (p.type === "integer" || p.type === "number") return 1;
  if (p.type === "boolean") return true;
  if (p.type === "array") return ["aa:bb:cc:dd:ee:ff"];
  return "ID1";
}

let netTools: Tool[];

beforeAll(async () => {
  const { tools } = await listLiveTools();
  netTools = tools.filter((t) => t.name.startsWith("unifi_net_"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("every hand-written path exists in the vendor spec (M-3, M-4, M-5, M-7)", () => {
  it("calls only paths that the vendor fixture defines", async () => {
    const templates = vendorTemplates();
    expect(templates.length).toBeGreaterThan(40);
    const regexes = templates.map(templateRegex);
    stubFetch();
    const { client, close } = await connectInProcess();
    const unknown: string[] = [];
    const silent: string[] = [];
    try {
      for (const tool of netTools) {
        const props = (tool.inputSchema.properties ?? {}) as Record<string, Prop>;
        const args: Record<string, unknown> = { filter: "x" };
        for (const name of tool.inputSchema.required ?? []) args[name] = sample(props[name] ?? {});
        if ("confirm" in props) args.confirm = "YES";
        for (const k of Object.keys(args)) if (!(k in props)) delete args[k];
        const before = calls.length;
        await client.callTool({ name: tool.name, arguments: args });
        if (calls.length === before) silent.push(tool.name);
        for (const c of calls.slice(before)) {
          if (!regexes.some((r) => r.test(c.path)))
            unknown.push(`${tool.name}: ${c.method} ${c.path}`);
        }
      }
    } finally {
      await close();
    }
    expect(netTools.length).toBeGreaterThan(70);
    expect(unknown).toEqual([]);
    // Only the two tools without a vendor endpoint send nothing (N-6).
    expect(silent.sort()).toEqual(["unifi_net_block_client", "unifi_net_unblock_client"]);
  });
});

interface Case {
  tool: string;
  args: Record<string, unknown>;
  expect: Array<Partial<Recorded>>;
}

const CASES: Case[] = [
  // M-3 switching
  {
    tool: "unifi_net_list_switch_stacks",
    args: {},
    expect: [{ method: "GET", path: `/v1/sites/${SITE}/switching/switch-stacks` }],
  },
  {
    tool: "unifi_net_get_switch_stack",
    args: { id: "S1" },
    expect: [{ method: "GET", path: `/v1/sites/${SITE}/switching/switch-stacks/S1` }],
  },
  {
    tool: "unifi_net_list_mclag_domains",
    args: {},
    expect: [{ method: "GET", path: `/v1/sites/${SITE}/switching/mc-lag-domains` }],
  },
  {
    tool: "unifi_net_get_mclag_domain",
    args: { id: "M1" },
    expect: [{ method: "GET", path: `/v1/sites/${SITE}/switching/mc-lag-domains/M1` }],
  },
  {
    tool: "unifi_net_list_lags",
    args: {},
    expect: [{ method: "GET", path: `/v1/sites/${SITE}/switching/lags` }],
  },
  {
    tool: "unifi_net_get_lag",
    args: { id: "L1" },
    expect: [{ method: "GET", path: `/v1/sites/${SITE}/switching/lags/L1` }],
  },
  // M-4 pending devices (console level, keeps offset/limit/filter)
  {
    tool: "unifi_net_list_pending_devices",
    args: { offset: 5, limit: 10, filter: "model.eq('U7')" },
    expect: [
      {
        method: "GET",
        path: "/v1/pending-devices",
        query: { offset: "5", limit: "10", filter: "model.eq('U7')" },
      },
    ],
  },
  // M-5 adopt: one POST per MAC with the vendor body
  {
    tool: "unifi_net_adopt_devices",
    args: { macs: ["aa:bb:cc:dd:ee:01", "aa:bb:cc:dd:ee:02"], confirm: "YES" },
    expect: [
      {
        method: "POST",
        path: `/v1/sites/${SITE}/devices`,
        body: { macAddress: "aa:bb:cc:dd:ee:01", ignoreDeviceLimit: false },
      },
      {
        method: "POST",
        path: `/v1/sites/${SITE}/devices`,
        body: { macAddress: "aa:bb:cc:dd:ee:02", ignoreDeviceLimit: false },
      },
    ],
  },
  // M-6 vendor action values; old lowercase inputs are mapped
  {
    tool: "unifi_net_reboot_device",
    args: { deviceId: "D1", confirm: "YES" },
    expect: [
      { method: "POST", path: `/v1/sites/${SITE}/devices/D1/actions`, body: { action: "RESTART" } },
    ],
  },
  {
    tool: "unifi_net_device_action",
    args: { deviceId: "D1", action: "restart", confirm: "YES" },
    expect: [{ body: { action: "RESTART" } }],
  },
  {
    tool: "unifi_net_device_action",
    args: { deviceId: "D1", action: "RESTART", confirm: "YES" },
    expect: [{ body: { action: "RESTART" } }],
  },
  {
    tool: "unifi_net_port_action",
    args: { deviceId: "D1", portIdx: 3, action: "power-cycle", confirm: "YES" },
    expect: [
      {
        method: "POST",
        path: `/v1/sites/${SITE}/devices/D1/interfaces/ports/3/actions`,
        body: { action: "POWER_CYCLE" },
      },
    ],
  },
  {
    tool: "unifi_net_port_action",
    args: { deviceId: "D1", portIdx: 3, action: "POWER_CYCLE", confirm: "YES" },
    expect: [{ body: { action: "POWER_CYCLE" } }],
  },
  {
    tool: "unifi_net_client_action",
    args: { clientId: "K1", action: "authorize-guest-access", confirm: "YES" },
    expect: [
      {
        method: "POST",
        path: `/v1/sites/${SITE}/clients/K1/actions`,
        body: { action: "AUTHORIZE_GUEST_ACCESS" },
      },
    ],
  },
  // M-7 radius and DPI
  {
    tool: "unifi_net_list_radius_profiles",
    args: { limit: 2 },
    expect: [{ method: "GET", path: `/v1/sites/${SITE}/radius/profiles`, query: { limit: "2" } }],
  },
  {
    tool: "unifi_net_list_dpi_application_categories",
    args: { offset: 1 },
    expect: [{ method: "GET", path: "/v1/dpi/categories", query: { offset: "1" } }],
  },
  {
    tool: "unifi_net_list_dpi_applications",
    args: { filter: "x" },
    expect: [{ method: "GET", path: "/v1/dpi/applications", query: { filter: "x" } }],
  },
  // N-7 bulk voucher delete sends the filter as query, not as body
  {
    tool: "unifi_net_delete_vouchers",
    args: { filter: "expired.eq(true)", confirm: "YES" },
    expect: [
      {
        method: "DELETE",
        path: `/v1/sites/${SITE}/hotspot/vouchers`,
        query: { filter: "expired.eq(true)" },
        body: undefined,
      },
    ],
  },
  {
    tool: "unifi_net_delete_vouchers",
    args: { body: { filter: "expired.eq(true)" }, confirm: "YES" },
    expect: [
      {
        method: "DELETE",
        path: `/v1/sites/${SITE}/hotspot/vouchers`,
        query: { filter: "expired.eq(true)" },
        body: undefined,
      },
    ],
  },
  // N-2 ids are one encoded path segment
  {
    tool: "unifi_net_delete_network",
    args: { id: "abc?force=true", confirm: "YES" },
    expect: [
      { method: "DELETE", path: `/v1/sites/${SITE}/networks/abc%3Fforce%3Dtrue`, query: {} },
    ],
  },
  {
    tool: "unifi_net_get_device",
    args: { deviceId: "victim#" },
    expect: [{ method: "GET", path: `/v1/sites/${SITE}/devices/victim%23` }],
  },
  {
    tool: "unifi_net_client_action",
    args: { clientId: "a/b", action: "X", confirm: "YES" },
    expect: [{ path: `/v1/sites/${SITE}/clients/a%2Fb/actions` }],
  },
  // N-1 control characters cannot smuggle dot segments
  {
    tool: "unifi_net_delete_voucher",
    args: { id: ".\t./x", confirm: "YES" },
    expect: [{ method: "DELETE", path: `/v1/sites/${SITE}/hotspot/vouchers/.%09.%2Fx` }],
  },
];

describe("hand-written handlers send the vendor request (table)", () => {
  it.each(CASES.map((c) => [`${c.tool} ${JSON.stringify(c.args)}`, c] as const))(
    "%s",
    async (_label, c) => {
      stubFetch();
      const { client, close } = await connectInProcess();
      try {
        const res = await client.callTool({ name: c.tool, arguments: c.args });
        expect(res.isError, firstText(res)).toBeFalsy();
      } finally {
        await close();
      }
      expect(calls).toHaveLength(c.expect.length);
      c.expect.forEach((want, i) => expect(calls[i]).toMatchObject(want));
      for (const [i, want] of c.expect.entries()) {
        if ("body" in want && want.body === undefined) expect(calls[i]?.body).toBeUndefined();
      }
    },
  );
});

describe("error paths", () => {
  it("block/unblock return an explicit not-supported error and send nothing (N-6)", async () => {
    stubFetch();
    const { client, close } = await connectInProcess();
    try {
      for (const name of ["unifi_net_block_client", "unifi_net_unblock_client"]) {
        const res = await client.callTool({ name, arguments: { clientId: "K1", confirm: "YES" } });
        expect(res.isError).toBe(true);
        expect(firstText(res)).toMatch(/not supported/i);
      }
    } finally {
      await close();
    }
    expect(calls).toEqual([]);
  });

  it("delete_vouchers without a filter is refused and sends nothing (N-7)", async () => {
    stubFetch();
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({
        name: "unifi_net_delete_vouchers",
        arguments: { confirm: "YES" },
      });
      expect(res.isError).toBe(true);
      expect(firstText(res)).toMatch(/filter/);
    } finally {
      await close();
    }
    expect(calls).toEqual([]);
  });

  it("delete_vouchers preview shows the filter query", async () => {
    stubFetch();
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({
        name: "unifi_net_delete_vouchers",
        arguments: { filter: "expired.eq(true)" },
      });
      const preview = (JSON.parse(firstText(res)) as { data: { preview: { url: string } } }).data
        .preview;
      expect(preview.url).toContain("/hotspot/vouchers?filter=expired.eq%28true%29");
    } finally {
      await close();
    }
    expect(calls).toEqual([]);
  });

  it("adopt reports per-MAC results and flags a partial failure", async () => {
    stubFetch(400);
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({
        name: "unifi_net_adopt_devices",
        arguments: { macs: ["aa:bb:cc:dd:ee:01", "aa:bb:cc:dd:ee:02"], confirm: "YES" },
      });
      expect(res.isError).toBe(true);
      const payload = JSON.parse(firstText(res)) as {
        details: { results: Array<{ mac: string; ok: boolean; statusCode?: number }> };
      };
      expect(payload.details.results.map((r) => [r.mac, r.ok, r.statusCode])).toEqual([
        ["aa:bb:cc:dd:ee:01", false, 400],
        ["aa:bb:cc:dd:ee:02", false, 400],
      ]);
    } finally {
      await close();
    }
    expect(calls).toHaveLength(2);
  });

  it("raw paths with control characters are refused before fetch (N-1)", async () => {
    stubFetch();
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({
        name: "unifi_raw_request",
        arguments: {
          method: "GET",
          path: "/v1/connector/consoles/C/proxy/network/integration/v1/sites/S/.\t./.\n./x",
        },
      });
      expect(res.isError).toBe(true);
      expect(firstText(res)).toMatch(/control characters/);
    } finally {
      await close();
    }
    expect(calls).toEqual([]);
  });
});
