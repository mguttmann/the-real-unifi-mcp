// AUTO-GENERATED from network/v11.0.97/updatefirewallpolicy. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { networkPath, withQuery } from "../../client/unifiClient.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_updatefirewallpolicy",
    {
      title: "unifi_gen_updatefirewallpolicy",
      description: "Update Firewall Policy - generated from developer.ui.com/network/v11.0.97/updatefirewallpolicy",
      inputSchema: z.object({firewallPolicyId: z.string().guid(), body: z.union([z.looseObject({action: z.looseObject({}),connectionStateFilter: z.array(z.unknown()).optional(),description: z.string().optional(),destination: z.looseObject({}),enabled: z.boolean(),ipProtocolScope: z.looseObject({}),ipsecFilter: z.enum(["MATCH_ENCRYPTED","MATCH_NOT_ENCRYPTED"]).optional(),loggingEnabled: z.boolean(),name: z.string(),reportFlowEnabled: z.boolean().optional(),schedule: z.looseObject({}).optional(),source: z.looseObject({})}), z.unknown()]).describe("JSON request body, sent as is. Top-level vendor fields only; full schema: vendor docs page in the description. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_updatefirewallpolicy", method: "PUT", url: withQuery(networkPath(await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/firewall/policies/${encodeURIComponent(String(a.firewallPolicyId))}`), undefined), body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("PUT", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/firewall/policies/${encodeURIComponent(String(a.firewallPolicyId))}`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return apiErrorResult(err);
          throw err;
        }
      });
    },
  );
}
