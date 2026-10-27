import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { z } from "zod";
import { readOnly, netGetRoot, lenientPagShape, lenientPagQuery } from "./common.js";

export function registerSitesTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_sites",
    {
      title: "List Network sites",
      description:
        "Lists the local sites that the Network application exposes (NOT the same as Site Manager sites).",
      inputSchema: z.object(lenientPagShape(200)),
      annotations: readOnly,
    },
    async (a) => netGetRoot(ctx, "/v1/sites", lenientPagQuery(a, 200)),
  );
}
