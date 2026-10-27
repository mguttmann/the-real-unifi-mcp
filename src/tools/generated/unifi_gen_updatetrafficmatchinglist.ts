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
      inputSchema: z.object({trafficMatchingListId: z.string().guid(), body: z.union([z.union([z.looseObject({items: z.array(z.union([z.looseObject({value: z.string().describe("IPv4 address"),type: z.literal("IP_ADDRESS").optional()}),z.looseObject({start: z.string().describe("IPv4 start address"),stop: z.string().describe("IPv4 stop address"),type: z.literal("IP_ADDRESS_RANGE").optional()}),z.looseObject({value: z.string().describe("IPv4 subnet in CIDR notation"),type: z.literal("SUBNET").optional()})])),type: z.literal("IPV4_ADDRESSES").optional()}),z.looseObject({items: z.array(z.union([z.looseObject({value: z.string().describe("IPv6 address"),type: z.literal("IP_ADDRESS").optional()}),z.looseObject({value: z.string().describe("IPv6 subnet in CIDR notation"),type: z.literal("SUBNET").optional()})])),type: z.literal("IPV6_ADDRESSES").optional()}),z.looseObject({items: z.array(z.union([z.looseObject({value: z.number().int().min(1).max(65535).describe("Port number"),type: z.literal("PORT_NUMBER").optional()}),z.looseObject({start: z.number().int().min(1).max(65535).describe("Start port number"),stop: z.number().int().min(1).max(65535).describe("Stop port number"),type: z.literal("PORT_NUMBER_RANGE").optional()})])),type: z.literal("PORTS").optional()})]), z.unknown()]).describe("JSON request body, sent unchanged. The vendor schema is given for reference; a value that does not match it is still sent as is. The API requires a body.").optional(), ...confirmShape}),
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
