// AUTO-GENERATED from network/v11.0.97/updatefirewallpolicyordering. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { networkPath, withQuery } from "../../client/unifiClient.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_updatefirewallpolicyordering",
    {
      title: "unifi_gen_updatefirewallpolicyordering",
      description: "Reorder User-Defined Firewall Policies - generated from developer.ui.com/network/v11.0.97/updatefirewallpolicyordering",
      inputSchema: z.object({sourceFirewallZoneId: z.string().guid(), destinationFirewallZoneId: z.string().guid(), body: z.union([z.looseObject({orderedFirewallPolicyIds: z.looseObject({afterSystemDefined: z.array(z.string().guid()),beforeSystemDefined: z.array(z.string().guid())})}), z.unknown()]).describe("JSON request body, sent unchanged. The vendor schema is given for reference; a value that does not match it is still sent as is. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_updatefirewallpolicyordering", method: "PUT", url: withQuery(networkPath(await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/firewall/policies/ordering`), {sourceFirewallZoneId: a.sourceFirewallZoneId, destinationFirewallZoneId: a.destinationFirewallZoneId}), body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("PUT", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/firewall/policies/ordering`, { body: a.body, query: {sourceFirewallZoneId: a.sourceFirewallZoneId, destinationFirewallZoneId: a.destinationFirewallZoneId} });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return apiErrorResult(err);
          throw err;
        }
      });
    },
  );
}
