/**
 * Every hand-written tool (`unifi_sm_*`, `unifi_net_*`, `unifi_raw_request`)
 * against a fake `fetch` (audit N-45): method, path, query and body of each
 * request, and for write tools the confirm guard (preview without a request,
 * preview URL equal to the request target).
 *
 * The real server runs in-process (dummy key, unreachable API base, discovery
 * overrides). `fetch` is stubbed, so no request leaves the process.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Tool } from "@modelcontextprotocol/server";
import { connectInProcess, listLiveTools, OFFLINE_CONFIG } from "../contract/liveTools.js";

const NET = `/v1/connector/consoles/${OFFLINE_CONFIG.consoleIdOverride}/proxy/network/integration`;
const SITE = `${NET}/v1/sites/${OFFLINE_CONFIG.networkSiteIdOverride}`;

interface Sent {
  method: string;
  path: string;
  query: Array<[string, string]>;
  body: unknown;
}

let sent: Sent[] = [];

function stubFetch() {
  sent = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const u = new URL(url);
    sent.push({
      method: String(init.method),
      path: u.pathname,
      query: [...u.searchParams],
      body: init.body === undefined ? undefined : JSON.parse(init.body as string),
    });
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function text(res: unknown): string {
  return (res as { content: Array<{ text?: string }> }).content[0]?.text ?? "";
}

/** One expected request; `query` is the ordered list of sent query pairs. */
interface Want {
  method: string;
  path: string;
  query?: Array<[string, string]>;
  body?: unknown;
}

interface Row {
  tool: string;
  args: Record<string, unknown>;
  /** Requests in order; empty when the tool must send nothing. */
  want: Want[];
  /** The tool answers with an error result (no request for an empty `want`). */
  error?: RegExp;
}

const pag = { offset: 1, limit: 2, filter: "name.eq('x')" };
const pagQuery: Array<[string, string]> = [
  ["offset", "1"],
  ["limit", "2"],
  ["filter", "name.eq('x')"],
];
const B = { name: "x", nested: { a: [1, 2] } };

function get(path: string, query: Array<[string, string]> = []): Want {
  return { method: "GET", path, query, body: undefined };
}

const ROWS: Row[] = [
  // Site Manager
  { tool: "unifi_sm_list_hosts", args: {}, want: [get("/v1/hosts")] },
  { tool: "unifi_sm_get_host", args: { id: "H 1/2" }, want: [get("/v1/hosts/H%201%2F2")] },
  {
    tool: "unifi_sm_list_hosts",
    args: { pageSize: 10, nextToken: "t1" },
    want: [
      get("/v1/hosts", [
        ["pageSize", "10"],
        ["nextToken", "t1"],
      ]),
    ],
  },
  // N-39: a value of the wrong type was stripped by 0.2.1; it is still ignored.
  { tool: "unifi_sm_list_hosts", args: { pageSize: { bad: 1 } }, want: [get("/v1/hosts")] },
  { tool: "unifi_sm_list_sites", args: {}, want: [get("/v1/sites")] },
  {
    tool: "unifi_sm_list_sites",
    args: { pageSize: "5", nextToken: "t2" },
    want: [
      get("/v1/sites", [
        ["pageSize", "5"],
        ["nextToken", "t2"],
      ]),
    ],
  },
  { tool: "unifi_sm_list_devices", args: {}, want: [get("/v1/devices")] },
  {
    tool: "unifi_sm_list_devices",
    args: { hostIds: ["h1", "h2"], time: "2026-01-01T00:00:00Z", pageSize: 5, nextToken: "t3" },
    want: [
      get("/v1/devices", [
        ["hostIds[]", "h1"],
        ["hostIds[]", "h2"],
        ["time", "2026-01-01T00:00:00Z"],
        ["pageSize", "5"],
        ["nextToken", "t3"],
      ]),
    ],
  },
  {
    tool: "unifi_sm_get_isp_metrics",
    args: { type: "5m", beginTimestamp: "2026-01-01T00:00:00Z", endTimestamp: "2026-01-02" },
    want: [
      get("/v1/isp-metrics/5m", [
        ["beginTimestamp", "2026-01-01T00:00:00Z"],
        ["endTimestamp", "2026-01-02"],
      ]),
    ],
  },
  {
    tool: "unifi_sm_get_isp_metrics",
    args: { type: "1h", duration: "7d" },
    want: [get("/v1/isp-metrics/1h", [["duration", "7d"]])],
  },
  {
    tool: "unifi_sm_query_isp_metrics",
    args: { type: "1h", body: B },
    want: [{ method: "POST", path: "/v1/isp-metrics/1h/query", query: [], body: B }],
  },
  { tool: "unifi_sm_list_sdwan_configs", args: {}, want: [get("/v1/sd-wan-configs")] },
  {
    tool: "unifi_sm_get_sdwan_config",
    args: { id: "W/1" },
    want: [get("/v1/sd-wan-configs/W%2F1")],
  },
  {
    tool: "unifi_sm_get_sdwan_config_status",
    args: { id: "W1" },
    want: [get("/v1/sd-wan-configs/W1/status")],
  },
  {
    tool: "unifi_sm_identity",
    args: {},
    want: [get(`/v1/hosts/${OFFLINE_CONFIG.consoleIdOverride}`)],
  },
  // Raw request
  {
    tool: "unifi_raw_request",
    args: { method: "GET", path: "/v1/hosts", query: { pageSize: "5" } },
    want: [get("/v1/hosts", [["pageSize", "5"]])],
  },
  {
    tool: "unifi_raw_request",
    args: { method: "POST", path: "/v1/isp-metrics/5m/query", body: B, confirm: "YES" },
    want: [{ method: "POST", path: "/v1/isp-metrics/5m/query", query: [], body: B }],
  },
  {
    tool: "unifi_raw_request",
    args: { method: "DELETE", path: "/v1/x", query: { force: "true" }, confirm: "YES" },
    want: [{ method: "DELETE", path: "/v1/x", query: [["force", "true"]], body: undefined }],
  },
  // Network: info and sites
  { tool: "unifi_net_get_info", args: {}, want: [get(`${NET}/v1/info`)] },
  { tool: "unifi_net_list_sites", args: {}, want: [get(`${NET}/v1/sites`)] },
  { tool: "unifi_net_list_sites", args: pag, want: [get(`${NET}/v1/sites`, pagQuery)] },
  // Devices
  { tool: "unifi_net_list_devices", args: pag, want: [get(`${SITE}/devices`, pagQuery)] },
  { tool: "unifi_net_get_device", args: { deviceId: "D#1" }, want: [get(`${SITE}/devices/D%231`)] },
  {
    tool: "unifi_net_get_device_stats",
    args: { deviceId: "D1" },
    want: [get(`${SITE}/devices/D1/statistics/latest`)],
  },
  {
    tool: "unifi_net_list_pending_devices",
    args: pag,
    want: [get(`${NET}/v1/pending-devices`, pagQuery)],
  },
  {
    tool: "unifi_net_adopt_devices",
    args: { macs: ["aa:bb:cc:dd:ee:01", "aa:bb:cc:dd:ee:02"], confirm: "YES" },
    want: [
      {
        method: "POST",
        path: `${SITE}/devices`,
        query: [],
        body: { macAddress: "aa:bb:cc:dd:ee:01", ignoreDeviceLimit: false },
      },
      {
        method: "POST",
        path: `${SITE}/devices`,
        query: [],
        body: { macAddress: "aa:bb:cc:dd:ee:02", ignoreDeviceLimit: false },
      },
    ],
  },
  {
    tool: "unifi_net_device_action",
    args: { deviceId: "D1", action: "restart", confirm: "YES" },
    want: [
      {
        method: "POST",
        path: `${SITE}/devices/D1/actions`,
        query: [],
        body: { action: "RESTART" },
      },
    ],
  },
  {
    tool: "unifi_net_reboot_device",
    args: { deviceId: "D1", confirm: "YES" },
    want: [
      {
        method: "POST",
        path: `${SITE}/devices/D1/actions`,
        query: [],
        body: { action: "RESTART" },
      },
    ],
  },
  {
    tool: "unifi_net_port_action",
    args: { deviceId: "D1", portIdx: 4, action: "power-cycle", body: { extra: 1 }, confirm: "YES" },
    want: [
      {
        method: "POST",
        path: `${SITE}/devices/D1/interfaces/ports/4/actions`,
        query: [],
        body: { action: "POWER_CYCLE", extra: 1 },
      },
    ],
  },
  // N-65: body.action does not override the mapped action
  {
    tool: "unifi_net_port_action",
    args: {
      deviceId: "D1",
      portIdx: 4,
      action: "power-cycle",
      body: { action: "RESTART", extra: 1 },
      confirm: "YES",
    },
    want: [
      {
        method: "POST",
        path: `${SITE}/devices/D1/interfaces/ports/4/actions`,
        query: [],
        body: { action: "POWER_CYCLE", extra: 1 },
      },
    ],
  },
  {
    tool: "unifi_net_remove_device",
    args: { deviceId: "D1", confirm: "YES" },
    want: [{ method: "DELETE", path: `${SITE}/devices/D1`, query: [], body: undefined }],
  },
  // Clients
  { tool: "unifi_net_list_clients", args: pag, want: [get(`${SITE}/clients`, pagQuery)] },
  { tool: "unifi_net_get_client", args: { clientId: "K1" }, want: [get(`${SITE}/clients/K1`)] },
  {
    tool: "unifi_net_client_action",
    args: { clientId: "K1", action: "authorize guest access", confirm: "YES" },
    want: [
      {
        method: "POST",
        path: `${SITE}/clients/K1/actions`,
        query: [],
        body: { action: "AUTHORIZE_GUEST_ACCESS" },
      },
    ],
  },
  {
    tool: "unifi_net_block_client",
    args: { clientId: "K1", confirm: "YES" },
    want: [],
    error: /not supported/,
  },
  {
    tool: "unifi_net_unblock_client",
    args: { clientId: "K1", confirm: "YES" },
    want: [],
    error: /not supported/,
  },
  // Networks, WiFi, firewall, ACL, DNS, traffic lists: list/get/create/update/delete
  ...crud("network", "networks", "/networks", { list: pag }),
  {
    tool: "unifi_net_get_network_references",
    args: { id: "N1" },
    want: [get(`${SITE}/networks/N1/references`)],
  },
  ...crud("wifi", "wifi", "/wifi/broadcasts", { list: pag }),
  ...crud("firewall_zone", "firewall_zones", "/firewall/zones", { list: pag }),
  ...crud("firewall_policy", "firewall_policies", "/firewall/policies", { list: pag }),
  {
    tool: "unifi_net_patch_firewall_policy",
    args: { id: "P1", body: B, confirm: "YES" },
    want: [{ method: "PATCH", path: `${SITE}/firewall/policies/P1`, query: [], body: B }],
  },
  {
    tool: "unifi_net_get_firewall_policy_ordering",
    args: {},
    want: [get(`${SITE}/firewall/policies/ordering`)],
  },
  {
    tool: "unifi_net_reorder_firewall_policies",
    args: { body: B, confirm: "YES" },
    want: [{ method: "PUT", path: `${SITE}/firewall/policies/ordering`, query: [], body: B }],
  },
  ...crud("acl_rule", "acl_rules", "/acl-rules", { list: pag }),
  { tool: "unifi_net_list_acl_rules", args: { limit: 500 }, want: [get(`${SITE}/acl-rules`)] },
  { tool: "unifi_net_get_acl_rule_ordering", args: {}, want: [get(`${SITE}/acl-rules/ordering`)] },
  {
    tool: "unifi_net_reorder_acl_rules",
    args: { body: B, confirm: "YES" },
    want: [{ method: "PUT", path: `${SITE}/acl-rules/ordering`, query: [], body: B }],
  },
  ...crud("dns_policy", "dns_policies", "/dns/policies", { list: pag }),
  ...crud("traffic_list", "traffic_lists", "/traffic-matching-lists", { list: pag }),
  // Hotspot
  { tool: "unifi_net_list_vouchers", args: {}, want: [get(`${SITE}/hotspot/vouchers`)] },
  {
    tool: "unifi_net_list_vouchers",
    args: { offset: 0, limit: 1000, filter: "expired.eq(true)" },
    want: [
      get(`${SITE}/hotspot/vouchers`, [
        ["offset", "0"],
        ["limit", "1000"],
        ["filter", "expired.eq(true)"],
      ]),
    ],
  },
  { tool: "unifi_net_get_voucher", args: { id: "V1" }, want: [get(`${SITE}/hotspot/vouchers/V1`)] },
  {
    tool: "unifi_net_create_vouchers",
    args: { body: B, confirm: "YES" },
    want: [{ method: "POST", path: `${SITE}/hotspot/vouchers`, query: [], body: B }],
  },
  {
    tool: "unifi_net_delete_voucher",
    args: { id: "V1", confirm: "YES" },
    want: [{ method: "DELETE", path: `${SITE}/hotspot/vouchers/V1`, query: [], body: undefined }],
  },
  {
    tool: "unifi_net_delete_vouchers",
    args: { filter: "expired.eq(true)", confirm: "YES" },
    want: [
      {
        method: "DELETE",
        path: `${SITE}/hotspot/vouchers`,
        query: [["filter", "expired.eq(true)"]],
        body: undefined,
      },
    ],
  },
  {
    tool: "unifi_net_delete_vouchers",
    args: { confirm: "YES" },
    want: [],
    error: /needs `filter`/,
  },
  // Switching
  {
    tool: "unifi_net_list_switch_stacks",
    args: pag,
    want: [get(`${SITE}/switching/switch-stacks`, pagQuery)],
  },
  {
    tool: "unifi_net_get_switch_stack",
    args: { id: "S1" },
    want: [get(`${SITE}/switching/switch-stacks/S1`)],
  },
  {
    tool: "unifi_net_list_mclag_domains",
    args: pag,
    want: [get(`${SITE}/switching/mc-lag-domains`, pagQuery)],
  },
  {
    tool: "unifi_net_get_mclag_domain",
    args: { id: "M1" },
    want: [get(`${SITE}/switching/mc-lag-domains/M1`)],
  },
  { tool: "unifi_net_list_lags", args: pag, want: [get(`${SITE}/switching/lags`, pagQuery)] },
  { tool: "unifi_net_get_lag", args: { id: "L1" }, want: [get(`${SITE}/switching/lags/L1`)] },
  // Supporting
  { tool: "unifi_net_list_wans", args: pag, want: [get(`${SITE}/wans`, pagQuery)] },
  {
    tool: "unifi_net_list_site_to_site_vpn",
    args: pag,
    want: [get(`${SITE}/vpn/site-to-site-tunnels`, pagQuery)],
  },
  { tool: "unifi_net_list_vpn_servers", args: pag, want: [get(`${SITE}/vpn/servers`, pagQuery)] },
  {
    tool: "unifi_net_list_radius_profiles",
    args: pag,
    want: [get(`${SITE}/radius/profiles`, pagQuery)],
  },
  { tool: "unifi_net_list_device_tags", args: pag, want: [get(`${SITE}/device-tags`, pagQuery)] },
  {
    tool: "unifi_net_list_dpi_application_categories",
    args: pag,
    want: [get(`${NET}/v1/dpi/categories`, pagQuery)],
  },
  {
    tool: "unifi_net_list_dpi_applications",
    args: pag,
    want: [get(`${NET}/v1/dpi/applications`, pagQuery)],
  },
  { tool: "unifi_net_list_countries", args: pag, want: [get(`${NET}/v1/countries`, pagQuery)] },
];

/** list/get/create/update/delete rows of one resource. */
function crud(
  one: string,
  many: string,
  sub: string,
  opts: { list?: Record<string, unknown> },
): Row[] {
  const base = `${SITE}${sub}`;
  return [
    {
      tool: `unifi_net_list_${many}`,
      args: opts.list ?? {},
      want: [get(base, opts.list ? pagQuery : [])],
    },
    { tool: `unifi_net_get_${one}`, args: { id: "I/1" }, want: [get(`${base}/I%2F1`)] },
    {
      tool: `unifi_net_create_${one}`,
      args: { body: B, confirm: "YES" },
      want: [{ method: "POST", path: base, query: [], body: B }],
    },
    {
      tool: `unifi_net_update_${one}`,
      args: { id: "I1", body: B, confirm: "YES" },
      want: [{ method: "PUT", path: `${base}/I1`, query: [], body: B }],
    },
    {
      tool: `unifi_net_delete_${one}`,
      args: { id: "I1", confirm: "YES" },
      want: [{ method: "DELETE", path: `${base}/I1`, query: [], body: undefined }],
    },
  ];
}

let tools: Map<string, Tool>;

beforeAll(async () => {
  const live = await listLiveTools();
  tools = new Map(live.tools.map((t) => [t.name, t]));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function isWrite(name: string): boolean {
  return tools.get(name)?.annotations?.readOnlyHint === false;
}

describe("hand-written tool table (N-45)", () => {
  it("has a row for every hand-written tool", () => {
    const hand = [...tools.keys()].filter((n) => !n.startsWith("unifi_gen_"));
    const covered = new Set(ROWS.map((r) => r.tool));
    expect(hand.filter((n) => !covered.has(n))).toEqual([]);
    expect([...covered].filter((n) => !tools.has(n))).toEqual([]);
  });

  it.each(ROWS.map((r) => [`${r.tool} ${JSON.stringify(r.args)}`, r] as const))(
    "%s sends the expected request",
    async (_label, row) => {
      stubFetch();
      const { client, close } = await connectInProcess();
      let res;
      try {
        res = await client.callTool({ name: row.tool, arguments: row.args });
      } finally {
        await close();
      }
      if (row.error) {
        expect(res.isError).toBe(true);
        expect(text(res)).toMatch(row.error);
      } else {
        expect(res.isError, text(res)).toBeFalsy();
      }
      expect(sent).toHaveLength(row.want.length);
      row.want.forEach((w, i) => {
        const got = sent[i]!;
        expect({ method: got.method, path: got.path }).toEqual({ method: w.method, path: w.path });
        expect(got.query).toEqual(w.query ?? []);
        expect(got.body).toEqual(w.body);
      });
    },
  );

  const guarded = ROWS.filter(
    (r) => r.want.length > 0 && r.want.every((w) => w.method !== "GET") && r.args.confirm === "YES",
  );

  it.each(guarded.map((r) => [`${r.tool} ${JSON.stringify(r.args)}`, r] as const))(
    "%s without confirm returns the preview of that request and sends nothing",
    async (_label, row) => {
      expect(isWrite(row.tool)).toBe(true);
      const fetchMock = stubFetch();
      const { confirm: _c, ...args } = row.args;
      const { client, close } = await connectInProcess();
      let res;
      try {
        res = await client.callTool({ name: row.tool, arguments: args });
      } finally {
        await close();
      }
      expect(res.isError, text(res)).toBeFalsy();
      expect(fetchMock).not.toHaveBeenCalled();
      const preview = (
        JSON.parse(text(res)) as {
          data: { preview: { tool: string; method: string; url: string; body?: unknown } };
        }
      ).data.preview;
      const w = row.want[0]!;
      const qs = new URLSearchParams(w.query ?? []).toString();
      expect(preview.tool).toBe(row.tool);
      expect(preview.method).toBe(w.method);
      expect(preview.url).toBe(`${w.path}${qs ? `?${qs}` : ""}`);
      const wantBody = row.want.length > 1 ? row.want.map((x) => x.body) : w.body;
      expect(preview.body).toEqual(wantBody);
    },
  );
});

describe("preview URL equals the request target (N-66, N-26)", () => {
  const guarded = ROWS.filter(
    (r) => r.want.length > 0 && r.want.every((w) => w.method !== "GET") && r.args.confirm === "YES",
  );

  it.each(guarded.map((r) => [`${r.tool} ${JSON.stringify(r.args)}`, r] as const))(
    "%s with a console id that needs encoding",
    async (_label, row) => {
      const cfg = { consoleIdOverride: "con sole/1", networkSiteIdOverride: "site 1" };
      stubFetch();
      const { confirm: _c, ...args } = row.args;
      const { client, close } = await connectInProcess(cfg);
      let preview: { url: string };
      try {
        const res = await client.callTool({ name: row.tool, arguments: args });
        preview = (JSON.parse(text(res)) as { data: { preview: { url: string } } }).data.preview;
        await client.callTool({ name: row.tool, arguments: row.args });
      } finally {
        await close();
      }
      const first = sent[0]!;
      const qs = new URLSearchParams(first.query).toString();
      expect(preview.url).toBe(`${first.path}${qs ? `?${qs}` : ""}`);
    },
  );

  it("generated write tools show their query params in the preview", async () => {
    stubFetch();
    const { client, close } = await connectInProcess({ consoleIdOverride: "con sole/1" });
    try {
      for (const [name, args, qs] of [
        [
          "unifi_gen_deletenetwork",
          { networkId: "00000000-0000-4000-8000-000000000000", force: true },
          "?force=true",
        ],
        [
          "unifi_gen_deletevouchers",
          { filter: "expired.eq(true)" },
          "?filter=expired.eq%28true%29",
        ],
      ] as const) {
        const res = await client.callTool({ name, arguments: args });
        const url = (JSON.parse(text(res)) as { data: { preview: { url: string } } }).data.preview
          .url;
        expect(url.startsWith("/v1/connector/consoles/con%20sole%2F1/")).toBe(true);
        expect(url.endsWith(qs)).toBe(true);
      }
    } finally {
      await close();
    }
    expect(sent).toEqual([]);
  });
});

describe("error details carry statusCode and code (N-86)", () => {
  function stubError() {
    sent = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const u = new URL(url);
      sent.push({ method: String(init.method), path: u.pathname, query: [], body: undefined });
      return new Response(JSON.stringify({ message: "gone", code: "api.err.NotFound" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
  }

  type Prop = { type?: string; enum?: unknown[] };
  function sample(p: Prop): unknown {
    if (Array.isArray(p.enum) && p.enum.length > 0) return p.enum[0];
    if (p.type === "integer" || p.type === "number") return 1;
    if (p.type === "boolean") return true;
    if (p.type === "array") return ["x"];
    return "00000000-0000-4000-8000-000000000000";
  }

  it("for every hand-written and generated tool that sends a request", async () => {
    stubError();
    const calls: Array<[string, Record<string, unknown>]> = [];
    const seen = new Set<string>();
    for (const r of ROWS) {
      // adopt reports per MAC; identity ignores a failing host lookup
      if (r.want.length === 0 || seen.has(r.tool)) continue;
      if (r.tool === "unifi_net_adopt_devices" || r.tool === "unifi_sm_identity") continue;
      seen.add(r.tool);
      calls.push([r.tool, { ...r.args, confirm: "YES" }]);
    }
    for (const t of tools.values()) {
      if (!t.name.startsWith("unifi_gen_")) continue;
      const props = (t.inputSchema.properties ?? {}) as Record<string, Prop>;
      const args: Record<string, unknown> = {};
      for (const k of t.inputSchema.required ?? []) args[k] = sample(props[k] ?? {});
      if ("confirm" in props) args.confirm = "YES";
      calls.push([t.name, args]);
    }
    const wrong: string[] = [];
    const { client, close } = await connectInProcess();
    try {
      for (const [name, args] of calls) {
        const res = await client.callTool({ name, arguments: args });
        const payload = JSON.parse(text(res)) as { details?: Record<string, unknown> };
        if (
          !res.isError ||
          payload.details?.statusCode !== 404 ||
          payload.details?.code !== "api.err.NotFound"
        )
          wrong.push(`${name}: ${text(res).slice(0, 200)}`);
      }
    } finally {
      await close();
    }
    expect(wrong).toEqual([]);
  });
});
