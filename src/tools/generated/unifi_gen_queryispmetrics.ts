// AUTO-GENERATED from site-manager/v1.0.0/queryispmetrics. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { withQuery } from "../../client/unifiClient.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_queryispmetrics",
    {
      title: "unifi_gen_queryispmetrics",
      description: "Query ISP Metrics - generated from developer.ui.com/site-manager/v1.0.0/queryispmetrics",
      inputSchema: z.object({type: z.string().describe("Specifies whether metrics are returned using `5m` or `1h` intervals"), body: z.union([z.looseObject({sites: z.array(z.looseObject({beginTimestamp: z.string().optional(),hostId: z.string(),endTimestamp: z.string().optional(),siteId: z.string()}).nullable()).optional()}), z.unknown()]).describe("JSON request body, sent unchanged. The vendor schema is given for reference; a value that does not match it is still sent as is.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_queryispmetrics", method: "POST", url: withQuery(`/v1/isp-metrics/${encodeURIComponent(String(a.type))}/query`, undefined), body: a.body }, async () => {
        try {
          const res = await ctx.client.request("POST", `/v1/isp-metrics/${encodeURIComponent(String(a.type))}/query`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return apiErrorResult(err);
          throw err;
        }
      });
    },
  );
}
