import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../server.js";
import { errorResult, jsonResult } from "./helpers.js";
import { UnifiApiError } from "../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

async function getJson(
  ctx: ServerContext,
  method: "GET" | "POST",
  path: string,
  opts?: { body?: unknown; query?: Record<string, string | number | undefined> },
) {
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
    { title: "List hosts", description: "Account-level: list all UniFi consoles linked to this Site Manager account.", inputSchema: {}, annotations: readOnly },
    async () => getJson(ctx, "GET", "/v1/hosts"),
  );

  server.registerTool(
    "unifi_sm_get_host",
    {
      title: "Get host detail",
      description: "Account-level: detail for a single host (console).",
      inputSchema: { id: z.string().describe("Host id (consoleId from list_hosts)") },
      annotations: readOnly,
    },
    async (a) => getJson(ctx, "GET", `/v1/hosts/${encodeURIComponent(a.id)}`),
  );

  server.registerTool(
    "unifi_sm_list_sites",
    { title: "List Site Manager sites", description: "Account-level sites.", inputSchema: {}, annotations: readOnly },
    async () => getJson(ctx, "GET", "/v1/sites"),
  );

  server.registerTool(
    "unifi_sm_list_devices",
    { title: "List devices (account)", description: "Account-level devices view (not the deep Network-API per-site list).", inputSchema: {}, annotations: readOnly },
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
      annotations: readOnly,
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
      annotations: readOnly,
    },
    async (a) => getJson(ctx, "POST", `/v1/isp-metrics/${a.type}/query`, { body: a.body }),
  );

  server.registerTool(
    "unifi_sm_list_sdwan_configs",
    { title: "List SD-WAN configurations", description: "Account-level SD-WAN configurations.", inputSchema: {}, annotations: readOnly },
    async () => getJson(ctx, "GET", "/v1/sd-wan-configs"),
  );

  server.registerTool(
    "unifi_sm_get_sdwan_config",
    {
      title: "Get SD-WAN configuration",
      description: "Get a single SD-WAN configuration.",
      inputSchema: { id: z.string().describe("SD-WAN config id") },
      annotations: readOnly,
    },
    async (a) => getJson(ctx, "GET", `/v1/sd-wan-configs/${encodeURIComponent(a.id)}`),
  );

  server.registerTool(
    "unifi_sm_get_sdwan_config_status",
    {
      title: "Get SD-WAN configuration status",
      description: "Status of a SD-WAN configuration.",
      inputSchema: { id: z.string() },
      annotations: readOnly,
    },
    async (a) => getJson(ctx, "GET", `/v1/sd-wan-configs/${encodeURIComponent(a.id)}/status`),
  );

  server.registerTool(
    "unifi_sm_identity",
    {
      title: "Resolved identity",
      description: "Returns consoleId, networkSiteId, siteManagerSiteId — useful for sanity checks.",
      inputSchema: {},
      annotations: readOnly,
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
