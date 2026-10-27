import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../server.js";
import {
  apiErrorResult,
  errorResult,
  jsonResult,
  lenientOptional,
  validOrUndefined,
} from "./helpers.js";
import { UnifiApiError } from "../client/errors.js";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

async function getJson(
  ctx: ServerContext,
  method: "GET" | "POST",
  path: string,
  opts?: { body?: unknown; query?: Record<string, unknown> },
) {
  try {
    const res = await ctx.client.request(method, path, opts ?? {});
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return apiErrorResult(err);
    throw err;
  }
}

// Site Manager paging (audit N-39): the vendor types pageSize as a string;
// a number is sent as its decimal text. Added in 0.3.0, so lenient (see
// lenientOptional): a value of another type is left out, as 0.2.1 did.
const pageSizeSchema = z.union([z.number().int().positive(), z.string().min(1)]);
const tokenSchema = z.string().min(1);
const pageShape = {
  pageSize: lenientOptional(pageSizeSchema, "Number of items per page"),
  nextToken: lenientOptional(
    tokenSchema,
    "Token from the previous page (`nextToken` of the response) for the next page",
  ),
};
function pageQuery(a: { pageSize?: unknown; nextToken?: unknown }) {
  return {
    pageSize: validOrUndefined(pageSizeSchema, a.pageSize),
    nextToken: validOrUndefined(tokenSchema, a.nextToken),
  };
}
const hostIdsSchema = z.array(z.string());
const timeSchema = z.string().min(1);
const durationSchema = z.enum(["24h", "7d", "30d"]);

export function registerSiteManagerTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_sm_list_hosts",
    {
      title: "List hosts",
      description: "Account-level: list all UniFi consoles linked to this Site Manager account.",
      inputSchema: z.object(pageShape),
      annotations: readOnly,
    },
    async (a) => getJson(ctx, "GET", "/v1/hosts", { query: pageQuery(a) }),
  );

  server.registerTool(
    "unifi_sm_get_host",
    {
      title: "Get host detail",
      description: "Account-level: detail for a single host (console).",
      inputSchema: z.object({ id: z.string().describe("Host id (consoleId from list_hosts)") }),
      annotations: readOnly,
    },
    async (a) => getJson(ctx, "GET", `/v1/hosts/${encodeURIComponent(a.id)}`),
  );

  server.registerTool(
    "unifi_sm_list_sites",
    {
      title: "List Site Manager sites",
      description: "Account-level sites.",
      inputSchema: z.object(pageShape),
      annotations: readOnly,
    },
    async (a) => getJson(ctx, "GET", "/v1/sites", { query: pageQuery(a) }),
  );

  server.registerTool(
    "unifi_sm_list_devices",
    {
      title: "List devices (account)",
      description: "Account-level devices view (not the deep Network-API per-site list).",
      inputSchema: z.object({
        hostIds: lenientOptional(hostIdsSchema, "Only devices of these host (console) ids"),
        time: lenientOptional(
          timeSchema,
          "Last processed timestamp of devices (RFC 3339), as in the vendor docs",
        ),
        ...pageShape,
      }),
      annotations: readOnly,
    },
    async (a) =>
      getJson(ctx, "GET", "/v1/devices", {
        query: {
          "hostIds[]": validOrUndefined(hostIdsSchema, a.hostIds),
          time: validOrUndefined(timeSchema, a.time),
          ...pageQuery(a),
        },
      }),
  );

  server.registerTool(
    "unifi_sm_get_isp_metrics",
    {
      title: "Get ISP metrics",
      description: "ISP metrics for a granularity bucket.",
      inputSchema: z.object({
        type: z.enum(["5m", "1h"]).describe("Granularity"),
        beginTimestamp: z.string().optional().describe("ISO timestamp (begin)"),
        endTimestamp: z.string().optional().describe("ISO timestamp (end)"),
        duration: lenientOptional(
          durationSchema,
          "Time range ending now: 24h, 7d or 30d (vendor values). Do not combine with beginTimestamp or endTimestamp; the API decides how it treats both.",
        ),
      }),
      annotations: readOnly,
    },
    async (a) =>
      getJson(ctx, "GET", `/v1/isp-metrics/${encodeURIComponent(a.type)}`, {
        query: {
          beginTimestamp: a.beginTimestamp,
          endTimestamp: a.endTimestamp,
          duration: validOrUndefined(durationSchema, a.duration),
        },
      }),
  );

  server.registerTool(
    "unifi_sm_query_isp_metrics",
    {
      title: "Query ISP metrics",
      description: "POST a time-window query for ISP metrics.",
      inputSchema: z.object({
        type: z.enum(["5m", "1h"]),
        body: z.unknown().optional().describe("Query body: see UniFi Site Manager docs for shape."),
      }),
      annotations: readOnly,
    },
    async (a) =>
      getJson(ctx, "POST", `/v1/isp-metrics/${encodeURIComponent(a.type)}/query`, { body: a.body }),
  );

  server.registerTool(
    "unifi_sm_list_sdwan_configs",
    {
      title: "List SD-WAN configurations",
      description: "Account-level SD-WAN configurations.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => getJson(ctx, "GET", "/v1/sd-wan-configs"),
  );

  server.registerTool(
    "unifi_sm_get_sdwan_config",
    {
      title: "Get SD-WAN configuration",
      description: "Get a single SD-WAN configuration.",
      inputSchema: z.object({ id: z.string().describe("SD-WAN config id") }),
      annotations: readOnly,
    },
    async (a) => getJson(ctx, "GET", `/v1/sd-wan-configs/${encodeURIComponent(a.id)}`),
  );

  server.registerTool(
    "unifi_sm_get_sdwan_config_status",
    {
      title: "Get SD-WAN configuration status",
      description: "Status of a SD-WAN configuration.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => getJson(ctx, "GET", `/v1/sd-wan-configs/${encodeURIComponent(a.id)}/status`),
  );

  server.registerTool(
    "unifi_sm_identity",
    {
      title: "Resolved identity",
      description: "Returns consoleId, networkSiteId, siteManagerSiteId: useful for sanity checks.",
      inputSchema: z.object({}),
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
