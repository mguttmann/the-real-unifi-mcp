import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { apiPath } from "../helpers.js";
import { confirmShape } from "../destructiveGuard.js";
import { readOnly, writeOnce, writeIdempotent, pagShape, netGet, netWrite } from "./common.js";

export function registerNetworkTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_networks",
    {
      title: "List networks",
      description: "Networks configured on the current site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/networks`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );
  server.registerTool(
    "unifi_net_get_network",
    {
      title: "Get network",
      description: "Detail for one network.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/networks/${a.id}`),
  );
  server.registerTool(
    "unifi_net_get_network_references",
    {
      title: "Get network references",
      description: "References to this network from other objects.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/networks/${a.id}/references`),
  );
  server.registerTool(
    "unifi_net_create_network",
    {
      title: "Create network",
      description: "Creates a new network on the current site. Body shape per Network API docs.",
      inputSchema: z.object({
        body: z.unknown().optional().describe("Network create payload"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_create_network",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/networks`,
        a.body,
      ),
  );
  server.registerTool(
    "unifi_net_update_network",
    {
      title: "Update network",
      description: "Updates an existing network.",
      inputSchema: z.object({ id: z.string(), body: z.unknown().optional(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_update_network",
        "PUT",
        (sid) => apiPath`/v1/sites/${sid}/networks/${a.id}`,
        a.body,
      ),
  );
  server.registerTool(
    "unifi_net_delete_network",
    {
      title: "Delete network",
      description: "Deletes a network. IRREVERSIBLE.",
      inputSchema: z.object({ id: z.string(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_delete_network",
        "DELETE",
        (sid) => apiPath`/v1/sites/${sid}/networks/${a.id}`,
      ),
  );
}
