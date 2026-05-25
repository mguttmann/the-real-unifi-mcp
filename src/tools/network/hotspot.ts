import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

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
  const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
  return runGuarded(ctx.cfg, a, { toolName, method, url: fullUrl, body }, async () => {
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
  server.registerTool(
    "unifi_net_list_vouchers",
    { title: "List vouchers", description: "Hotspot vouchers configured on the current site.", inputSchema: {}, annotations: readOnly },
    async () => netGet(ctx, (sid) => `/v1/sites/${sid}/hotspot/vouchers`),
  );
  server.registerTool(
    "unifi_net_get_voucher",
    { title: "Get voucher", description: "Hotspot voucher detail for a single voucher.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/hotspot/vouchers/${a.id}`),
  );
  server.registerTool(
    "unifi_net_create_vouchers",
    {
      title: "Create vouchers",
      description: "Generates one or more hotspot vouchers. Body shape per UniFi docs (count, name, duration, …).",
      inputSchema: { body: z.unknown().describe("Voucher generation payload"), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => netWrite(ctx, a, "unifi_net_create_vouchers", "POST", (sid) => `/v1/sites/${sid}/hotspot/vouchers`, a.body),
  );
  server.registerTool(
    "unifi_net_delete_voucher",
    {
      title: "Delete voucher",
      description: "Deletes a single hotspot voucher.",
      inputSchema: { id: z.string(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_delete_voucher", "DELETE", (sid) => `/v1/sites/${sid}/hotspot/vouchers/${a.id}`),
  );
  server.registerTool(
    "unifi_net_delete_vouchers",
    {
      title: "Delete vouchers",
      description: "Deletes multiple vouchers (filter via query body).",
      inputSchema: { body: z.unknown().optional(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_delete_vouchers", "DELETE", (sid) => `/v1/sites/${sid}/hotspot/vouchers`, a.body),
  );
}
