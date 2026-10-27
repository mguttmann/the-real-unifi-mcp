// AUTO-GENERATED from site-manager/v1.0.0/getsdwanconfigstatus. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_getsdwanconfigstatus",
    {
      title: "unifi_gen_getsdwanconfigstatus",
      description: "Get SD-WAN Config Status - generated from developer.ui.com/site-manager/v1.0.0/getsdwanconfigstatus",
      inputSchema: z.object({id: z.string().describe("Unique identifier of the SD-WAN configuration")}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.request("GET", `/v1/sd-wan-configs/${encodeURIComponent(String(a.id))}/status`, { body: undefined, query: undefined });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
