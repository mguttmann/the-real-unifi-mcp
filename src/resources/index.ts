import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../server.js";
import { registerIdentityResource } from "./identity.js";
import { registerHostsResources } from "./hosts.js";

export function registerResources(server: McpServer, ctx: ServerContext): void {
  registerIdentityResource(server, ctx);
  registerHostsResources(server, ctx);
}
