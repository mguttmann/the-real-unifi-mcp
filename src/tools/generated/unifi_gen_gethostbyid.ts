// AUTO-GENERATED from site-manager/v1.0.0/gethostbyid. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_gethostbyid",
    {
      title: "unifi_gen_gethostbyid",
      description: "Get Host by ID - generated from developer.ui.com/site-manager/v1.0.0/gethostbyid",
      inputSchema: z.object({id: z.string().describe("Unique identifier of the host")}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.request("GET", `/v1/hosts/${encodeURIComponent(String(a.id))}`, { body: undefined, query: undefined });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
