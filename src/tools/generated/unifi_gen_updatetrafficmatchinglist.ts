// AUTO-GENERATED from network/v11.0.97/updatetrafficmatchinglist. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { networkPath, withQuery } from "../../client/unifiClient.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_updatetrafficmatchinglist",
    {
      title: "unifi_gen_updatetrafficmatchinglist",
      description: "Update Traffic Matching List - generated from developer.ui.com/network/v11.0.97/updatetrafficmatchinglist",
      inputSchema: z.object({trafficMatchingListId: z.string().guid(), body: z.union([z.looseObject({name: z.string(),type: z.enum(["IPV4_ADDRESSES","IPV6_ADDRESSES","PORTS"]),items: z.array(z.unknown())}), z.unknown()]).describe("JSON request body, sent as is. Top-level vendor fields only; full schema: vendor docs page in the description. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_updatetrafficmatchinglist", method: "PUT", url: withQuery(networkPath(await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/traffic-matching-lists/${encodeURIComponent(String(a.trafficMatchingListId))}`), undefined), body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("PUT", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/traffic-matching-lists/${encodeURIComponent(String(a.trafficMatchingListId))}`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return apiErrorResult(err);
          throw err;
        }
      });
    },
  );
}
