// AUTO-GENERATED from network/v11.0.97/getwifibroadcastpage. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_getwifibroadcastpage",
    {
      title: "unifi_gen_getwifibroadcastpage",
      description: "List Wifi Broadcasts - generated from developer.ui.com/network/v11.0.97/getwifibroadcastpage",
      inputSchema: z.object({offset: z.number().int().min(0).optional(), limit: z.number().int().min(0).max(200).optional(), filter: z.string().optional()}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.requestNetwork("GET", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/wifi/broadcasts`, { body: undefined, query: {offset: a.offset, limit: a.limit, filter: a.filter} });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
