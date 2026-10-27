// AUTO-GENERATED from network/v11.0.97/patchfirewallpolicy. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_patchfirewallpolicy",
    {
      title: "unifi_gen_patchfirewallpolicy",
      description: "Patch Firewall Policy - generated from developer.ui.com/network/v11.0.97/patchfirewallpolicy",
      inputSchema: z.object({firewallPolicyId: z.string().guid(), body: z.union([z.looseObject({loggingEnabled: z.boolean().optional(),reportFlowEnabled: z.boolean().describe("Report traffic matched by this policy in Insights Flows. Ignored for the predefined Allow Return Traffic policies and the predefined policies allowing only multicast or IPv6 neighbor discovery traffic, which are never reported.").optional()}), z.unknown()]).describe("JSON request body, sent unchanged. The vendor schema is given for reference; a value that does not match it is still sent as is. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_patchfirewallpolicy", method: "PATCH", url: `/v1/connector/consoles/${await ctx.discovery.consoleId()}/proxy/network/integration/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/firewall/policies/${encodeURIComponent(String(a.firewallPolicyId))}`, body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("PATCH", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/firewall/policies/${encodeURIComponent(String(a.firewallPolicyId))}`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
