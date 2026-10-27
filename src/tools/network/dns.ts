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

export function registerDnsTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_dns_policies",
    {
      title: "List DNS policies",
      description: "Lists all DNS policies configured on the current site.",
      inputSchema: z.object(lenientPagShape(200)),
      annotations: readOnly,
    },
    async (a) =>
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/dns/policies`, lenientPagQuery(a, 200)),
  );
  server.registerTool(
    "unifi_net_get_dns_policy",
    {
      title: "Get DNS policy",
      description: "Detail for one DNS policy.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/dns/policies/${a.id}`),
  );
  server.registerTool(
    "unifi_net_create_dns_policy",
    {
      title: "Create DNS policy",
      description: "Creates a new DNS policy on the current site. Body shape per Network API docs.",
      inputSchema: z.object({
        body: z.unknown().optional().describe("DNS policy create payload"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_create_dns_policy",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/dns/policies`,
        a.body,
      ),
  );
  server.registerTool(
    "unifi_net_update_dns_policy",
    {
      title: "Update DNS policy",
      description: "Updates an existing DNS policy.",
      inputSchema: z.object({ id: z.string(), body: z.unknown().optional(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_update_dns_policy",
        "PUT",
        (sid) => apiPath`/v1/sites/${sid}/dns/policies/${a.id}`,
        a.body,
      ),
  );
  server.registerTool(
    "unifi_net_delete_dns_policy",
    {
      title: "Delete DNS policy",
      description: "Deletes a DNS policy. IRREVERSIBLE.",
      inputSchema: z.object({ id: z.string(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_delete_dns_policy",
        "DELETE",
        (sid) => apiPath`/v1/sites/${sid}/dns/policies/${a.id}`,
      ),
  );
}
