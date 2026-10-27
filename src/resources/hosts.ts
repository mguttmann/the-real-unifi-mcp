import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import type { ServerContext } from "../server.js";

export function registerHostsResources(server: McpServer, ctx: ServerContext): void {
  // Fixed URI: list all hosts
  server.registerResource(
    "unifi-hosts",
    "unifi://hosts",
    {
      title: "UniFi hosts (account)",
      description: "GET /v1/hosts: list of consoles linked to this Site Manager account.",
      mimeType: "application/json",
    },
    async (uri) => {
      const res = await ctx.client.request("GET", "/v1/hosts");
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: JSON.stringify(res.data, null, 2) },
        ],
      };
    },
  );

  // Templated URI: detail for a single host by id
  server.registerResource(
    "unifi-host-detail",
    new ResourceTemplate("unifi://hosts/{id}", { list: undefined }),
    {
      title: "UniFi host detail",
      description: "GET /v1/hosts/{id}: metadata for a single console/host.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const id = Array.isArray(variables.id) ? variables.id[0] : variables.id;
      if (!id || typeof id !== "string") throw new Error("missing host id");
      const res = await ctx.client.request("GET", `/v1/hosts/${encodeURIComponent(id)}`);
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: JSON.stringify(res.data, null, 2) },
        ],
      };
    },
  );
}
