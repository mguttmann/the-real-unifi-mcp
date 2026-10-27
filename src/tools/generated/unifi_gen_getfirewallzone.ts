// AUTO-GENERATED from network/v11.0.97/getfirewallzone. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_getfirewallzone",
    {
      title: "unifi_gen_getfirewallzone",
      description: "Get Firewall Zone - generated from developer.ui.com/network/v11.0.97/getfirewallzone",
      inputSchema: z.object({firewallZoneId: z.string().guid()}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.requestNetwork("GET", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/firewall/zones/${encodeURIComponent(String(a.firewallZoneId))}`, { body: undefined, query: undefined });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return apiErrorResult(err);
        throw err;
      }
    },
  );
}
