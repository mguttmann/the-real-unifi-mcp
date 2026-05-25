// AUTO-GENERATED from network/v10.3.58/updatefirewallpolicyordering. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_updatefirewallpolicyordering",
    {
      title: "unifi_gen_updatefirewallpolicyordering",
      description: "Reorder User-Defined Firewall Policies — generated from developer.ui.com/network/v10.3.58/updatefirewallpolicyordering",
      inputSchema: {sourceFirewallZoneId: z.string().uuid(), destinationFirewallZoneId: z.string().uuid(), siteId: z.string().uuid(), body: z.unknown(), ...confirmShape},
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_updatefirewallpolicyordering", method: "PUT", url: `/v1/sites/${encodeURIComponent(String(a.siteId))}/firewall/policies/ordering`, body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("PUT", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(a.siteId))}/firewall/policies/ordering`, { body: a.body, query: {sourceFirewallZoneId: a.sourceFirewallZoneId, destinationFirewallZoneId: a.destinationFirewallZoneId} });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
