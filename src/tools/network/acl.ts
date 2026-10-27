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

export function registerAclTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_acl_rules",
    {
      title: "List ACL rules",
      description: "Lists all ACL rules on the current site.",
      inputSchema: z.object(lenientPagShape(200)),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/acl-rules`, lenientPagQuery(a, 200)),
  );

  server.registerTool(
    "unifi_net_get_acl_rule",
    {
      title: "Get ACL rule",
      description: "Detail for one ACL rule on the current site.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/acl-rules/${a.id}`),
  );

  server.registerTool(
    "unifi_net_create_acl_rule",
    {
      title: "Create ACL rule",
      description: "Creates a new ACL rule on the current site. Body shape per ACL API docs.",
      inputSchema: z.object({
        body: z.unknown().optional().describe("ACL rule create payload"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_create_acl_rule",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/acl-rules`,
        a.body,
      ),
  );

  server.registerTool(
    "unifi_net_update_acl_rule",
    {
      title: "Update ACL rule",
      description: "Updates an existing ACL rule on the current site (full replacement).",
      inputSchema: z.object({ id: z.string(), body: z.unknown().optional(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_update_acl_rule",
        "PUT",
        (sid) => apiPath`/v1/sites/${sid}/acl-rules/${a.id}`,
        a.body,
      ),
  );

  server.registerTool(
    "unifi_net_delete_acl_rule",
    {
      title: "Delete ACL rule",
      description: "Deletes an ACL rule on the current site. IRREVERSIBLE.",
      inputSchema: z.object({ id: z.string(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_delete_acl_rule",
        "DELETE",
        (sid) => apiPath`/v1/sites/${sid}/acl-rules/${a.id}`,
      ),
  );

  server.registerTool(
    "unifi_net_get_acl_rule_ordering",
    {
      title: "Get ACL rule ordering",
      description: "Returns the current ordering of ACL rules on the current site.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/acl-rules/ordering`),
  );

  server.registerTool(
    "unifi_net_reorder_acl_rules",
    {
      title: "Reorder ACL rules",
      description: "Sets the ordering of ACL rules on the current site.",
      inputSchema: z.object({
        body: z.unknown().optional().describe("ACL rule ordering payload"),
        ...confirmShape,
      }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_reorder_acl_rules",
        "PUT",
        (sid) => apiPath`/v1/sites/${sid}/acl-rules/ordering`,
        a.body,
      ),
  );
}
