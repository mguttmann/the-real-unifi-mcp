import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { apiPath } from "../helpers.js";
import { confirmShape } from "../destructiveGuard.js";
import { readOnly, writeOnce, writeIdempotent, pagShape, netGet, netWrite } from "./common.js";

export function registerFirewallTools(server: McpServer, ctx: ServerContext): void {
  // --- Zones ---
  server.registerTool(
    "unifi_net_list_firewall_zones",
    {
      title: "List firewall zones",
      description: "Lists all firewall zones on the current site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/firewall/zones`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );

  server.registerTool(
    "unifi_net_get_firewall_zone",
    {
      title: "Get firewall zone",
      description: "Detail for one firewall zone.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/firewall/zones/${a.id}`),
  );

  server.registerTool(
    "unifi_net_create_firewall_zone",
    {
      title: "Create firewall zone",
      description:
        "Creates a new firewall zone on the current site. Body shape per Firewall API docs.",
      inputSchema: z.object({
        body: z.unknown().optional().describe("Firewall zone create payload"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_create_firewall_zone",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/firewall/zones`,
        a.body,
      ),
  );

  server.registerTool(
    "unifi_net_update_firewall_zone",
    {
      title: "Update firewall zone",
      description: "Updates an existing firewall zone.",
      inputSchema: z.object({ id: z.string(), body: z.unknown().optional(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_update_firewall_zone",
        "PUT",
        (sid) => apiPath`/v1/sites/${sid}/firewall/zones/${a.id}`,
        a.body,
      ),
  );

  server.registerTool(
    "unifi_net_delete_firewall_zone",
    {
      title: "Delete firewall zone",
      description: "Deletes a firewall zone. IRREVERSIBLE.",
      inputSchema: z.object({ id: z.string(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_delete_firewall_zone",
        "DELETE",
        (sid) => apiPath`/v1/sites/${sid}/firewall/zones/${a.id}`,
      ),
  );

  // --- Policies ---
  server.registerTool(
    "unifi_net_list_firewall_policies",
    {
      title: "List firewall policies",
      description: "Lists all firewall policies on the current site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/firewall/policies`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );

  server.registerTool(
    "unifi_net_get_firewall_policy",
    {
      title: "Get firewall policy",
      description: "Detail for one firewall policy.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/firewall/policies/${a.id}`),
  );

  server.registerTool(
    "unifi_net_create_firewall_policy",
    {
      title: "Create firewall policy",
      description:
        "Creates a new firewall policy on the current site. Body shape per Firewall API docs.",
      inputSchema: z.object({
        body: z.unknown().optional().describe("Firewall policy create payload"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_create_firewall_policy",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/firewall/policies`,
        a.body,
      ),
  );

  server.registerTool(
    "unifi_net_update_firewall_policy",
    {
      title: "Update firewall policy",
      description: "Updates an existing firewall policy (full replacement).",
      inputSchema: z.object({ id: z.string(), body: z.unknown().optional(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_update_firewall_policy",
        "PUT",
        (sid) => apiPath`/v1/sites/${sid}/firewall/policies/${a.id}`,
        a.body,
      ),
  );

  server.registerTool(
    "unifi_net_patch_firewall_policy",
    {
      title: "Patch firewall policy",
      description: "Partially updates an existing firewall policy (PATCH semantics).",
      inputSchema: z.object({ id: z.string(), body: z.unknown().optional(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_patch_firewall_policy",
        "PATCH",
        (sid) => apiPath`/v1/sites/${sid}/firewall/policies/${a.id}`,
        a.body,
      ),
  );

  server.registerTool(
    "unifi_net_delete_firewall_policy",
    {
      title: "Delete firewall policy",
      description: "Deletes a firewall policy. IRREVERSIBLE.",
      inputSchema: z.object({ id: z.string(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_delete_firewall_policy",
        "DELETE",
        (sid) => apiPath`/v1/sites/${sid}/firewall/policies/${a.id}`,
      ),
  );

  // --- Ordering ---
  server.registerTool(
    "unifi_net_get_firewall_policy_ordering",
    {
      title: "Get firewall policy ordering",
      description: "Returns the current ordering of firewall policies on the current site.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/firewall/policies/ordering`),
  );

  server.registerTool(
    "unifi_net_reorder_firewall_policies",
    {
      title: "Reorder firewall policies",
      description: "Sets the ordering of firewall policies on the current site.",
      inputSchema: z.object({
        body: z.unknown().optional().describe("Policy ordering payload"),
        ...confirmShape,
      }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_reorder_firewall_policies",
        "PUT",
        (sid) => apiPath`/v1/sites/${sid}/firewall/policies/ordering`,
        a.body,
      ),
  );
}
