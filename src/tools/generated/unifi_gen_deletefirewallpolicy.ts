// AUTO-GENERATED from network/v10.3.58/deletefirewallpolicy. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_deletefirewallpolicy",
    {
      title: "unifi_gen_deletefirewallpolicy",
      description: "Delete Firewall Policy — generated from developer.ui.com/network/v10.3.58/deletefirewallpolicy",
      inputSchema: {firewallPolicyId: z.string().uuid(), siteId: z.string().uuid(), ...confirmShape},
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_deletefirewallpolicy", method: "DELETE", url: `/v1/sites/${encodeURIComponent(String(a.siteId))}/firewall/policies/${encodeURIComponent(String(a.firewallPolicyId))}`, body: undefined }, async () => {
        try {
          const res = await ctx.client.requestNetwork("DELETE", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(a.siteId))}/firewall/policies/${encodeURIComponent(String(a.firewallPolicyId))}`, { body: undefined, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
