// AUTO-GENERATED from network/v10.3.58/getadopteddevicelateststatistics. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_getadopteddevicelateststatistics",
    {
      title: "unifi_gen_getadopteddevicelateststatistics",
      description: "Get Latest Adopted Device Statistics — generated from developer.ui.com/network/v10.3.58/getadopteddevicelateststatistics",
      inputSchema: {siteId: z.string().uuid(), deviceId: z.string().uuid()},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.requestNetwork("GET", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(a.siteId))}/devices/${encodeURIComponent(String(a.deviceId))}/statistics/latest`, { body: undefined, query: undefined });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
