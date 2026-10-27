// AUTO-GENERATED from network/v11.0.97/creatednspolicy. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { networkPath, withQuery } from "../../client/unifiClient.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_creatednspolicy",
    {
      title: "unifi_gen_creatednspolicy",
      description: "Create DNS Policy - generated from developer.ui.com/network/v11.0.97/creatednspolicy",
      inputSchema: z.object({body: z.union([z.looseObject({enabled: z.boolean(),type: z.enum(["AAAA_RECORD","A_RECORD","CNAME_RECORD","FORWARD_DOMAIN","MX_RECORD","SRV_RECORD","TXT_RECORD"]),domain: z.string(),ipv6Address: z.string().optional(),ttlSeconds: z.number().optional(),ipv4Address: z.string().optional(),targetDomain: z.string().optional(),ipAddress: z.string().optional(),mailServerDomain: z.string().optional(),priority: z.number().optional(),port: z.number().optional(),protocol: z.string().optional(),serverDomain: z.string().optional(),service: z.string().optional(),weight: z.number().optional(),text: z.string().optional()}), z.unknown()]).describe("JSON request body, sent as is. Top-level vendor fields only; full schema: vendor docs page in the description. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_creatednspolicy", method: "POST", url: withQuery(networkPath(await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/dns/policies`), undefined), body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/dns/policies`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return apiErrorResult(err);
          throw err;
        }
      });
    },
  );
}
