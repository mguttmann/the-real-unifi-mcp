// AUTO-GENERATED from network/v11.0.97/executeportaction. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { networkPath, withQuery } from "../../client/unifiClient.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_executeportaction",
    {
      title: "unifi_gen_executeportaction",
      description: "Execute Port Action - generated from developer.ui.com/network/v11.0.97/executeportaction",
      inputSchema: z.object({portIdx: z.number().int(), deviceId: z.string().guid(), body: z.union([z.looseObject({action: z.literal("POWER_CYCLE").optional()}), z.unknown()]).describe("JSON request body, sent unchanged. The vendor schema is given for reference; a value that does not match it is still sent as is. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_executeportaction", method: "POST", url: withQuery(networkPath(await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/devices/${encodeURIComponent(String(a.deviceId))}/interfaces/ports/${encodeURIComponent(String(a.portIdx))}/actions`), undefined), body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/devices/${encodeURIComponent(String(a.deviceId))}/interfaces/ports/${encodeURIComponent(String(a.portIdx))}/actions`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return apiErrorResult(err);
          throw err;
        }
      });
    },
  );
}
