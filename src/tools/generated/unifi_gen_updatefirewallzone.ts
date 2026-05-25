// AUTO-GENERATED from network/v10.3.58/updatefirewallzone. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_updatefirewallzone",
    {
      title: "unifi_gen_updatefirewallzone",
      description: "Update Firewall Zone — generated from developer.ui.com/network/v10.3.58/updatefirewallzone",
      inputSchema: {firewallZoneId: z.string().uuid(), siteId: z.string().uuid(), body: z.unknown(), ...confirmShape},
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_updatefirewallzone", method: "PUT", url: `/v1/sites/${encodeURIComponent(String(a.siteId))}/firewall/zones/${encodeURIComponent(String(a.firewallZoneId))}`, body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("PUT", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(a.siteId))}/firewall/zones/${encodeURIComponent(String(a.firewallZoneId))}`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
