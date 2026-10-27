import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../server.js";

export function registerIdentityResource(server: McpServer, ctx: ServerContext): void {
  server.registerResource(
    "unifi-identity",
    "unifi://identity",
    {
      title: "Resolved UniFi identity",
      description: "Discovery output: consoleId + both siteIds + console metadata.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = await ctx.discovery.identity();
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: JSON.stringify(id, null, 2) },
        ],
      };
    },
  );
}
