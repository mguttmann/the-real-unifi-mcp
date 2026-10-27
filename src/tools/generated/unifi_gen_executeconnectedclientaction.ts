// AUTO-GENERATED from network/v11.0.97/executeconnectedclientaction. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { networkPath, withQuery } from "../../client/unifiClient.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_executeconnectedclientaction",
    {
      title: "unifi_gen_executeconnectedclientaction",
      description: "Execute Client Action - generated from developer.ui.com/network/v11.0.97/executeconnectedclientaction",
      inputSchema: z.object({clientId: z.string().guid(), body: z.union([z.union([z.looseObject({dataUsageLimitMBytes: z.number().int().min(1).max(1048576).describe("(Optional) data usage limit in megabytes").optional(),rxRateLimitKbps: z.number().int().min(2).max(100000).describe("(Optional) download rate limit in kilobits per second").optional(),timeLimitMinutes: z.number().int().min(1).max(1000000).describe("(Optional) how long (in minutes) the guest will be authorized to access the network. If not specified, the default limit is used from the site settings").optional(),txRateLimitKbps: z.number().int().min(2).max(100000).describe("(Optional) upload rate limit in kilobits per second").optional(),action: z.literal("AUTHORIZE_GUEST_ACCESS").optional()}),z.looseObject({action: z.literal("UNAUTHORIZE_GUEST_ACCESS").optional()})]), z.unknown()]).describe("JSON request body, sent unchanged. The vendor schema is given for reference; a value that does not match it is still sent as is. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_executeconnectedclientaction", method: "POST", url: withQuery(networkPath(await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/clients/${encodeURIComponent(String(a.clientId))}/actions`), undefined), body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/clients/${encodeURIComponent(String(a.clientId))}/actions`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return apiErrorResult(err);
          throw err;
        }
      });
    },
  );
}
