import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

export function registerSitesTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_sites",
    {
      title: "List Network sites",
      description: "Lists the local sites that the Network application exposes (NOT the same as Site Manager sites).",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => {
      try {
        const cid = await ctx.discovery.consoleId();
        const res = await ctx.client.requestNetwork("GET", cid, "/v1/sites");
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
