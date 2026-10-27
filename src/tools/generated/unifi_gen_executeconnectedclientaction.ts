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
      inputSchema: z.object({clientId: z.string().guid(), body: z.union([z.looseObject({action: z.enum(["AUTHORIZE_GUEST_ACCESS","UNAUTHORIZE_GUEST_ACCESS"]),dataUsageLimitMBytes: z.number().optional(),rxRateLimitKbps: z.number().optional(),timeLimitMinutes: z.number().optional(),txRateLimitKbps: z.number().optional()}), z.unknown()]).describe("JSON request body, sent as is. Top-level vendor fields only; full schema: vendor docs page in the description. The API requires a body.").optional(), ...confirmShape}),
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
