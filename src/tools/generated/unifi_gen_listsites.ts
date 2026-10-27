// AUTO-GENERATED from site-manager/v1.0.0/listsites. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult, includeStatisticsParam, siteStatistics } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_listsites",
    {
      title: "unifi_gen_listsites",
      description: "List Sites - generated from developer.ui.com/site-manager/v1.0.0/listsites",
      inputSchema: z.object({pageSize: z.string().describe("Number of items to return per page").optional(), nextToken: z.string().describe("Token for pagination to retrieve the next set of results").optional(), includeStatistics: includeStatisticsParam}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.request("GET", `/v1/sites`, { body: undefined, query: {pageSize: a.pageSize, nextToken: a.nextToken} });
        return jsonResult(siteStatistics(res.data, a.includeStatistics), { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return apiErrorResult(err);
        throw err;
      }
    },
  );
}
