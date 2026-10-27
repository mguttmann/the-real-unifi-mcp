import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { apiPath } from "../helpers.js";
import { confirmShape } from "../destructiveGuard.js";
import {
  readOnly,
  writeOnce,
  writeIdempotent,
  netGet,
  netWrite,
  lenientPagShape,
  lenientPagQuery,
} from "./common.js";

export function registerTrafficListTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_traffic_lists",
    {
      title: "List traffic matching lists",
      description: "Lists all traffic matching lists configured on the current site.",
      inputSchema: z.object(lenientPagShape(200)),
      annotations: readOnly,
    },
    async (a) =>
      netGet(
        ctx,
        (sid) => apiPath`/v1/sites/${sid}/traffic-matching-lists`,
        lenientPagQuery(a, 200),
      ),
  );
  server.registerTool(
    "unifi_net_get_traffic_list",
    {
      title: "Get traffic matching list",
      description: "Detail for one traffic matching list.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/traffic-matching-lists/${a.id}`),
  );
  server.registerTool(
    "unifi_net_create_traffic_list",
    {
      title: "Create traffic matching list",
      description:
        "Creates a new traffic matching list on the current site. Body shape per Network API docs.",
      inputSchema: z.object({
        body: z.unknown().optional().describe("Traffic matching list create payload"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_create_traffic_list",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/traffic-matching-lists`,
        a.body,
      ),
  );
  server.registerTool(
    "unifi_net_update_traffic_list",
    {
      title: "Update traffic matching list",
      description: "Updates an existing traffic matching list.",
      inputSchema: z.object({ id: z.string(), body: z.unknown().optional(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_update_traffic_list",
        "PUT",
        (sid) => apiPath`/v1/sites/${sid}/traffic-matching-lists/${a.id}`,
        a.body,
      ),
  );
  server.registerTool(
    "unifi_net_delete_traffic_list",
    {
      title: "Delete traffic matching list",
      description: "Deletes a traffic matching list. IRREVERSIBLE.",
      inputSchema: z.object({ id: z.string(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_delete_traffic_list",
        "DELETE",
        (sid) => apiPath`/v1/sites/${sid}/traffic-matching-lists/${a.id}`,
      ),
  );
}
