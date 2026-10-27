// AUTO-GENERATED from site-manager/v1.0.0/getispmetrics. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_getispmetrics",
    {
      title: "unifi_gen_getispmetrics",
      description: "Get ISP Metrics - generated from developer.ui.com/site-manager/v1.0.0/getispmetrics",
      inputSchema: z.object({type: z.string().describe("Specifies whether metrics are returned using `5m` or `1h` intervals"), beginTimestamp: z.string().describe("The earliest timestamp to retrieve data from (RFC3339 format)").optional(), endTimestamp: z.string().describe("The latest timestamp to retrieve data up to (RFC3339 format)").optional(), duration: z.string().describe("Specifies the time range of metrics to retrieve, starting from when the request is made. Supports `24h` for 5-minute metrics, and `7d` or `30d` for 1-hour metrics. This parameter **cannot** be used with `beginTimestamp` or `endTimestamp`.").optional()}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      try {
        const res = await ctx.client.request("GET", `/v1/isp-metrics/${encodeURIComponent(String(a.type))}`, { body: undefined, query: {beginTimestamp: a.beginTimestamp, endTimestamp: a.endTimestamp, duration: a.duration} });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return apiErrorResult(err);
        throw err;
      }
    },
  );
}
