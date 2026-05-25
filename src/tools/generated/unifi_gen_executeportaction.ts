// AUTO-GENERATED from network/v10.3.58/executeportaction. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_gen_executeportaction",
    {
      title: "unifi_gen_executeportaction",
      description: "Execute Port Action — generated from developer.ui.com/network/v10.3.58/executeportaction",
      inputSchema: {portIdx: z.number().int(), deviceId: z.string().uuid(), body: z.unknown(), ...confirmShape},
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (a) => {
      return runGuarded(ctx.cfg, a, { toolName: "unifi_gen_executeportaction", method: "POST", url: `/v1/connector/consoles/${await ctx.discovery.consoleId()}/proxy/network/integration/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/devices/${encodeURIComponent(String(a.deviceId))}/interfaces/ports/${encodeURIComponent(String(a.portIdx))}/actions`, body: a.body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", await ctx.discovery.consoleId(), `/v1/sites/${encodeURIComponent(String(await ctx.discovery.networkSiteId()))}/devices/${encodeURIComponent(String(a.deviceId))}/interfaces/ports/${encodeURIComponent(String(a.portIdx))}/actions`, { body: a.body, query: undefined });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
