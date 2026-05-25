// AUTO-GENERATED from network/v10.3.58/getmclagdomainpage. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_getmclagdomainpage",
    {
      title: "unifi_gen_getmclagdomainpage",
      description: "List MC-LAG Domains — generated from developer.ui.com/network/v10.3.58/getmclagdomainpage",
      inputSchema: {offset: z.number().int().min(0).optional(), limit: z.number().int().min(0).max(200).optional(), filter: z.string().optional(), siteId: z.string().uuid()},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.requestNetwork("GET", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(a.siteId))}/switching/mc-lag-domains`, { body: undefined, query: {offset: a.offset, limit: a.limit, filter: a.filter} });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
