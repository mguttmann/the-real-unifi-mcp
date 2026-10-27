// AUTO-GENERATED from network/v10.3.58/gettrafficmatchinglist. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_gettrafficmatchinglist",
    {
      title: "unifi_gen_gettrafficmatchinglist",
      description: "Get Traffic Matching List - generated from developer.ui.com/network/v10.3.58/gettrafficmatchinglist",
      inputSchema: z.object({trafficMatchingListId: z.string().guid()}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.requestNetwork("GET", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/traffic-matching-lists/${encodeURIComponent(String(a.trafficMatchingListId))}`, { body: undefined, query: undefined });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
