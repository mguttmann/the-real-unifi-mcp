// AUTO-GENERATED from network/v10.3.58/deletetrafficmatchinglist. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_deletetrafficmatchinglist",
    {
      title: "unifi_gen_deletetrafficmatchinglist",
      description: "Delete Traffic Matching List — generated from developer.ui.com/network/v10.3.58/deletetrafficmatchinglist",
      inputSchema: {trafficMatchingListId: z.string().uuid(), siteId: z.string().uuid(), ...confirmShape},
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_deletetrafficmatchinglist", method: "DELETE", url: `/v1/sites/${encodeURIComponent(String(a.siteId))}/traffic-matching-lists/${encodeURIComponent(String(a.trafficMatchingListId))}`, body: undefined }, async () => {
        try {
          const res = await ctx.client.requestNetwork("DELETE", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(a.siteId))}/traffic-matching-lists/${encodeURIComponent(String(a.trafficMatchingListId))}`, { body: undefined, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
