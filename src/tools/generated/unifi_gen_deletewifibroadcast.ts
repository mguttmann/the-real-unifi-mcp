// AUTO-GENERATED from network/v10.3.58/deletewifibroadcast. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_deletewifibroadcast",
    {
      title: "unifi_gen_deletewifibroadcast",
      description: "Delete Wifi Broadcast — generated from developer.ui.com/network/v10.3.58/deletewifibroadcast",
      inputSchema: {wifiBroadcastId: z.string().uuid(), force: z.boolean().optional(), ...confirmShape},
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_deletewifibroadcast", method: "DELETE", url: `/v1/connector/consoles/${await ctx.discovery.consoleId()}/proxy/network/integration/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/wifi/broadcasts/${encodeURIComponent(String(a.wifiBroadcastId))}`, body: undefined }, async () => {
        try {
          const res = await ctx.client.requestNetwork("DELETE", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/wifi/broadcasts/${encodeURIComponent(String(a.wifiBroadcastId))}`, { body: undefined, query: {force: a.force} });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
