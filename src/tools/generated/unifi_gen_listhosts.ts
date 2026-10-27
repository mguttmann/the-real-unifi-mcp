// AUTO-GENERATED from site-manager/v1.0.0/listhosts. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_listhosts",
    {
      title: "unifi_gen_listhosts",
      description: "List Hosts - generated from developer.ui.com/site-manager/v1.0.0/listhosts",
      inputSchema: z.object({pageSize: z.string().describe("Number of items to return per page").optional(), nextToken: z.string().describe("Token for pagination to retrieve the next set of results").optional()}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.request("GET", `/v1/hosts`, { body: undefined, query: {pageSize: a.pageSize, nextToken: a.nextToken} });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return apiErrorResult(err);
        throw err;
      }
    },
  );
}
