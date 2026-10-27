// AUTO-GENERATED from network/v10.3.58/getfirewallpolicyordering. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_getfirewallpolicyordering",
    {
      title: "unifi_gen_getfirewallpolicyordering",
      description: "Get User-Defined Firewall Policy Ordering - generated from developer.ui.com/network/v10.3.58/getfirewallpolicyordering",
      inputSchema: z.object({sourceFirewallZoneId: z.string().guid(), destinationFirewallZoneId: z.string().guid()}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.requestNetwork("GET", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/firewall/policies/ordering`, { body: undefined, query: {sourceFirewallZoneId: a.sourceFirewallZoneId, destinationFirewallZoneId: a.destinationFirewallZoneId} });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
