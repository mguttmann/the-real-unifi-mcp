// AUTO-GENERATED from network/v11.0.97/updatednspolicy. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_updatednspolicy",
    {
      title: "unifi_gen_updatednspolicy",
      description: "Update DNS Policy - generated from developer.ui.com/network/v11.0.97/updatednspolicy",
      inputSchema: z.object({dnsPolicyId: z.string().guid(), body: z.union([z.union([z.looseObject({domain: z.string().min(1).max(127),ipv6Address: z.string(),ttlSeconds: z.number().int().min(0).max(86400).describe("Time to live in seconds."),type: z.literal("AAAA_RECORD").optional()}),z.looseObject({domain: z.string().min(1).max(127),ipv4Address: z.string(),ttlSeconds: z.number().int().min(0).max(86400).describe("Time to live in seconds."),type: z.literal("A_RECORD").optional()}),z.looseObject({domain: z.string().min(1).max(127),targetDomain: z.string().min(1).max(127),ttlSeconds: z.number().int().min(0).max(604800).describe("Time to live in seconds."),type: z.literal("CNAME_RECORD").optional()}),z.looseObject({domain: z.string().min(1).max(127),ipAddress: z.string().describe("IP address of the DNS Server that the DNS query is forwarded to."),type: z.literal("FORWARD_DOMAIN").optional()}),z.looseObject({domain: z.string().min(1).max(127),mailServerDomain: z.string().min(1).max(127),priority: z.number().int().min(0).max(65535).describe("Priority. A lower number is preferred."),type: z.literal("MX_RECORD").optional()}),z.looseObject({domain: z.string().min(1).max(127),port: z.number().int().min(0).max(65535),priority: z.number().int().min(0).max(65535).describe("Priority. A lower number is preferred."),protocol: z.string().describe("Protocol used by the service."),serverDomain: z.string().min(1).max(127).describe("Domain of the server that is running the service."),service: z.string().describe("Service associated with this SRV record."),weight: z.number().int().min(0).max(65535).describe("Weight. A relative value applicable for records with the same priority. A lower number is preferred."),type: z.literal("SRV_RECORD").optional()}),z.looseObject({domain: z.string().min(1).max(127),text: z.string().min(1).max(1024).describe("The text value associated with this TXT DNS record. Text can contain up to four 255-character strings. Lines containing commas must be enclosed in double quotes (\")."),type: z.literal("TXT_RECORD").optional()})]), z.unknown()]).describe("JSON request body, sent unchanged. The vendor schema is given for reference; a value that does not match it is still sent as is. The API requires a body.").optional(), ...confirmShape}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_updatednspolicy", method: "PUT", url: `/v1/connector/consoles/${await ctx.discovery.consoleId()}/proxy/network/integration/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/dns/policies/${encodeURIComponent(String(a.dnsPolicyId))}`, body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("PUT", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/dns/policies/${encodeURIComponent(String(a.dnsPolicyId))}`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
