import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { UnifiApiError } from "../../client/errors.js";
import { z } from "zod";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function registerInfoTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_get_info",
    {
      title: "Network application info",
      description:
        "Reads /v1/info on the Network application via the Cloud Connector. Useful as a health probe.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => {
      try {
        const cid = await ctx.discovery.consoleId();
        const res = await ctx.client.requestNetwork("GET", cid, "/v1/info");
        return jsonResult(res.data);
      } catch (err) {
        if (err instanceof UnifiApiError)
          return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );
}
