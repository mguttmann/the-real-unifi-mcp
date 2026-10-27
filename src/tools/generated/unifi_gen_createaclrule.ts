// AUTO-GENERATED from network/v11.0.97/createaclrule. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_createaclrule",
    {
      title: "unifi_gen_createaclrule",
      description: "Create ACL Rule - generated from developer.ui.com/network/v11.0.97/createaclrule",
      inputSchema: z.object({body: z.union([z.union([z.looseObject({destinationFilter: z.union([z.looseObject({ipAddressesOrSubnets: z.array(z.string().min(1)).describe("IP addresses or subnets"),portFilter: z.array(z.number().int().min(1).max(65535)).describe("Ports this ACL rule will be applied to. If null, all the rule will be applied to all ports.").optional(),type: z.literal("IP_ADDRESSES_OR_SUBNETS").optional()}),z.looseObject({networkIds: z.array(z.string().guid()).describe("Network IDs"),portFilter: z.array(z.number().int().min(1).max(65535)).describe("Ports this ACL rule will be applied to. If null, the rule will be applied to all ports.").optional(),type: z.literal("NETWORKS").optional()}),z.looseObject({portFilter: z.array(z.number().int().min(1).max(65535)).describe("Ports this ACL rule will be applied to."),type: z.literal("PORTS").optional()})]).describe("Traffic destination filter").optional(),protocolFilter: z.array(z.enum(["TCP","UDP"])).describe("Protocols this ACL rule will be applied to. When null, the rule will be applied to all protocols.").optional(),sourceFilter: z.union([z.looseObject({ipAddressesOrSubnets: z.array(z.string().min(1)).describe("IP addresses or subnets"),portFilter: z.array(z.number().int().min(1).max(65535)).describe("Ports this ACL rule will be applied to. If null, all the rule will be applied to all ports.").optional(),type: z.literal("IP_ADDRESSES_OR_SUBNETS").optional()}),z.looseObject({networkIds: z.array(z.string().guid()).describe("Network IDs"),portFilter: z.array(z.number().int().min(1).max(65535)).describe("Ports this ACL rule will be applied to. If null, the rule will be applied to all ports.").optional(),type: z.literal("NETWORKS").optional()}),z.looseObject({portFilter: z.array(z.number().int().min(1).max(65535)).describe("Ports this ACL rule will be applied to."),type: z.literal("PORTS").optional()})]).describe("Traffic source filter").optional(),type: z.literal("IPV4").optional()}),z.looseObject({destinationFilter: z.looseObject({macAddresses: z.array(z.string()).describe("Source/destination MAC addresses this ACL rule will apply to."),prefixLength: z.number().int().min(1).max(48).describe("MAC address prefix length. When null, full MAC address(-es) will be used.").optional(),type: z.literal("MAC_ADDRESSES").optional()}).describe("Traffic destination filter").optional(),networkIdFilter: z.string().guid().describe("Network ID to which this ACL rule applies"),sourceFilter: z.looseObject({macAddresses: z.array(z.string()).describe("Source/destination MAC addresses this ACL rule will apply to."),prefixLength: z.number().int().min(1).max(48).describe("MAC address prefix length. When null, full MAC address(-es) will be used.").optional(),type: z.literal("MAC_ADDRESSES").optional()}).describe("Traffic source filter").optional(),type: z.literal("MAC").optional()})]), z.unknown()]).describe("JSON request body, sent unchanged. The vendor schema is given for reference; a value that does not match it is still sent as is. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_createaclrule", method: "POST", url: `/v1/connector/consoles/${await ctx.discovery.consoleId()}/proxy/network/integration/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/acl-rules`, body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/acl-rules`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
