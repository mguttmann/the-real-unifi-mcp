import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { apiPath } from "../helpers.js";
import { confirmShape } from "../destructiveGuard.js";
import { readOnly, writeOnce, writeIdempotent, pagShape, netGet, netWrite } from "./common.js";

export function registerWifiTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_wifi",
    {
      title: "List WiFi broadcasts",
      description: "WLAN broadcasts.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/wifi/broadcasts`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );
  server.registerTool(
    "unifi_net_get_wifi",
    {
      title: "Get WiFi broadcast",
      description: "Detail for a WLAN.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/wifi/broadcasts/${a.id}`),
  );
  server.registerTool(
    "unifi_net_create_wifi",
    {
      title: "Create WiFi broadcast",
      description: "Creates a new WLAN.",
      inputSchema: z.object({
        body: z.unknown().optional().describe("WiFi broadcast create payload"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_create_wifi",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/wifi/broadcasts`,
        a.body,
      ),
  );
  server.registerTool(
    "unifi_net_update_wifi",
    {
      title: "Update WiFi broadcast",
      description: "Updates an existing WLAN.",
      inputSchema: z.object({ id: z.string(), body: z.unknown().optional(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_update_wifi",
        "PUT",
        (sid) => apiPath`/v1/sites/${sid}/wifi/broadcasts/${a.id}`,
        a.body,
      ),
  );
  server.registerTool(
    "unifi_net_delete_wifi",
    {
      title: "Delete WiFi broadcast",
      description: "Deletes a WLAN. IRREVERSIBLE.",
      inputSchema: z.object({ id: z.string(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_delete_wifi",
        "DELETE",
        (sid) => apiPath`/v1/sites/${sid}/wifi/broadcasts/${a.id}`,
      ),
  );
}
