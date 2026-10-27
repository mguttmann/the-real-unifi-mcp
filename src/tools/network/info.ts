import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { z } from "zod";
import { readOnly, netGetRoot } from "./common.js";

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
    async () => netGetRoot(ctx, "/v1/info"),
  );
}
