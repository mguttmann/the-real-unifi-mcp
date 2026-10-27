// AUTO-GENERATED from network/v11.0.97/updatewifibroadcast. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, apiErrorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { networkPath, withQuery } from "../../client/unifiClient.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_updatewifibroadcast",
    {
      title: "unifi_gen_updatewifibroadcast",
      description: "Update Wifi Broadcast - generated from developer.ui.com/network/v11.0.97/updatewifibroadcast",
      inputSchema: z.object({wifiBroadcastId: z.string().guid(), body: z.union([z.looseObject({basicDataRateKbpsByFrequencyGHz: z.looseObject({}).optional(),blackoutScheduleConfiguration: z.looseObject({}).optional(),broadcastingDeviceFilter: z.looseObject({}).optional(),channel2gLockedTo6: z.boolean(),clientFilteringPolicy: z.looseObject({}).optional(),clientIsolationEnabled: z.boolean(),dtimPeriod2gLockedTo3: z.boolean(),enabled: z.boolean(),hideName: z.boolean(),mdnsProxyConfiguration: z.looseObject({}).optional(),multicastFilteringPolicy: z.looseObject({}).optional(),multicastToUnicastConversionEnabled: z.boolean(),name: z.string(),network: z.looseObject({}).optional(),securityConfiguration: z.looseObject({}),type: z.enum(["IOT_OPTIMIZED","STANDARD"]),uapsdEnabled: z.boolean(),advertiseDeviceName: z.boolean().optional(),arpProxyEnabled: z.boolean().optional(),bandSteeringEnabled: z.boolean().optional(),broadcastingFrequenciesGHz: z.array(z.unknown()).optional(),bssTransitionEnabled: z.boolean().optional(),dnsAssistanceConfiguration: z.looseObject({}).optional(),dtimPeriodByFrequencyGHzOverride: z.looseObject({}).optional(),handoffSuggestionsConfiguration: z.looseObject({}).optional(),hotspotConfiguration: z.looseObject({}).optional(),mloEnabled: z.boolean().optional()}), z.unknown()]).describe("JSON request body, sent as is. Top-level vendor fields only; full schema: vendor docs page in the description. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_updatewifibroadcast", method: "PUT", url: withQuery(networkPath(await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/wifi/broadcasts/${encodeURIComponent(String(a.wifiBroadcastId))}`), undefined), body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("PUT", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/wifi/broadcasts/${encodeURIComponent(String(a.wifiBroadcastId))}`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return apiErrorResult(err);
          throw err;
        }
      });
    },
  );
}
