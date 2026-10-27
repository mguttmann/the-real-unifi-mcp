// AUTO-GENERATED from network/v11.0.97/getwansoverviewpage. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_getwansoverviewpage",
    {
      title: "unifi_gen_getwansoverviewpage",
      description: "List WAN Interfaces - generated from developer.ui.com/network/v11.0.97/getwansoverviewpage",
      inputSchema: z.object({offset: z.number().int().min(0).optional(), limit: z.number().int().min(0).max(200).optional()}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.requestNetwork("GET", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/wans`, { body: undefined, query: {offset: a.offset, limit: a.limit} });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return apiErrorResult(err);
        throw err;
      }
    },
  );
}
