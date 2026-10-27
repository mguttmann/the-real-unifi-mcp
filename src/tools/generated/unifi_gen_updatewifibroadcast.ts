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
      inputSchema: z.object({wifiBroadcastId: z.string().guid(), body: z.union([z.union([z.looseObject({type: z.literal("IOT_OPTIMIZED").optional()}),z.looseObject({advertiseDeviceName: z.boolean().describe("Indicates whether the device name is advertised in beacon frames."),arpProxyEnabled: z.boolean(),bandSteeringEnabled: z.boolean().optional(),broadcastingFrequenciesGHz: z.array(z.number()),bssTransitionEnabled: z.boolean(),dnsAssistanceConfiguration: z.union([z.looseObject({mode: z.literal("AUTO").optional()}),z.looseObject({servers: z.array(z.string()),mode: z.literal("MANUAL").optional()})]).optional(),dtimPeriodByFrequencyGHzOverride: z.looseObject({"5": z.number().int().min(1).max(255),"6": z.number().int().min(1).max(255),"2.4": z.number().int().min(1).max(255).describe("DTIM period for 2.4GHz band must be 3 when dtimPeriod2gLockedTo3 is enabled.")}).optional(),handoffSuggestionsConfiguration: z.looseObject({band5GHzRssiThreshold: z.number().int().min(-80).max(-60).describe("RSSI threshold (dBm) for the 5 GHz band. If null, then it is disabled.").optional(),band6GHzRssiThreshold: z.number().int().min(-90).max(-70).describe("RSSI threshold (dBm) for the 6 GHz band. If null, then it is disabled.").optional()}).describe("Suggests low-signal clients to roam to a better access point. If null, then it is disabled.").optional(),hotspotConfiguration: z.union([z.looseObject({type: z.literal("CAPTIVE_PORTAL").optional()}),z.looseObject({type: z.literal("PASSPOINT").optional()})]).optional(),mloEnabled: z.boolean().optional(),type: z.literal("STANDARD").optional()})]), z.unknown()]).describe("JSON request body, sent unchanged. The vendor schema is given for reference; a value that does not match it is still sent as is. The API requires a body.").optional(), ...confirmShape}),
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
