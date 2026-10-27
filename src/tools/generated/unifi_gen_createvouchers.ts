// AUTO-GENERATED from network/v11.0.97/createvouchers. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_createvouchers",
    {
      title: "unifi_gen_createvouchers",
      description: "Generate Vouchers - generated from developer.ui.com/network/v11.0.97/createvouchers",
      inputSchema: z.object({body: z.union([z.looseObject({authorizedGuestLimit: z.number().int().min(1).describe("(Optional) limit for how many different guests can use the same voucher to authorize network access").optional(),count: z.number().int().min(1).max(1000).describe("Number of vouchers to generate").optional(),dataUsageLimitMBytes: z.number().int().min(1).max(1048576).describe("(Optional) data usage limit in megabytes").optional(),name: z.string().min(1).describe("Voucher note, duplicated across all generated vouchers"),rxRateLimitKbps: z.number().int().min(2).max(100000).describe("(Optional) download rate limit in kilobits per second").optional(),timeLimitMinutes: z.number().int().min(1).max(1000000).describe("How long (in minutes) the voucher will provide access to the network since authorization of the first guest. Subsequently connected guests, if allowed, will share the same expiration time."),txRateLimitKbps: z.number().int().min(2).max(100000).describe("(Optional) upload rate limit in kilobits per second").optional()}), z.unknown()]).describe("JSON request body, sent unchanged. The vendor schema is given for reference; a value that does not match it is still sent as is. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_createvouchers", method: "POST", url: `/v1/connector/consoles/${await ctx.discovery.consoleId()}/proxy/network/integration/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/hotspot/vouchers`, body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/hotspot/vouchers`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
