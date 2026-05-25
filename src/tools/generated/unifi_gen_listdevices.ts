// AUTO-GENERATED from site-manager/v1.0.0/listdevices. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_listdevices",
    {
      title: "unifi_gen_listdevices",
      description: "List Devices — generated from developer.ui.com/site-manager/v1.0.0/listdevices",
      inputSchema: {"hostIds[]": z.array(z.string()).describe("List of host IDs to filter the results").optional(), time: z.string().describe("Last processed timestamp of devices in RFC3339 format").optional(), pageSize: z.string().describe("Number of items to return per page").optional(), nextToken: z.string().describe("Token for pagination to retrieve the next set of results").optional()},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.request("GET", `/v1/devices`, { body: undefined, query: {"hostIds[]": a["hostIds[]"], time: a.time, pageSize: a.pageSize, nextToken: a.nextToken} });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
