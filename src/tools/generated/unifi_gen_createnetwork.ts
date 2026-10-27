// AUTO-GENERATED from network/v11.0.97/createnetwork. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { networkPath, withQuery } from "../../client/unifiClient.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_createnetwork",
    {
      title: "unifi_gen_createnetwork",
      description: "Create Network - generated from developer.ui.com/network/v11.0.97/createnetwork",
      inputSchema: z.object({body: z.union([z.looseObject({dhcpGuarding: z.looseObject({}).optional(),enabled: z.boolean(),management: z.enum(["GATEWAY","SWITCH","UNMANAGED"]),name: z.string(),vlanId: z.number(),cellularBackupEnabled: z.boolean().optional(),internetAccessEnabled: z.boolean().optional(),ipv4Configuration: z.looseObject({}).optional(),ipv6Configuration: z.looseObject({}).optional(),isolationEnabled: z.boolean().optional(),mdnsForwardingEnabled: z.boolean().optional(),zoneId: z.string().optional(),deviceId: z.string().optional()}), z.unknown()]).describe("JSON request body, sent as is. Top-level vendor fields only; full schema: vendor docs page in the description. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_createnetwork", method: "POST", url: withQuery(networkPath(await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/networks`), undefined), body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/networks`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return apiErrorResult(err);
          throw err;
        }
      });
    },
  );
}
