import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(ctx: ServerContext, path: (sid: string) => string, query?: Record<string, string | number | undefined>) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

async function netWrite(
  ctx: ServerContext,
  a: { confirm?: "YES" },
  toolName: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  pathBuilder: (sid: string) => string,
  body?: unknown,
) {
  const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
  const docPath = pathBuilder(sid);
  return runGuarded(ctx.cfg, a, { toolName, method, url: docPath, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, cid, docPath, { body });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerFirewallTools(server: McpServer, ctx: ServerContext): void {
  // --- Zones ---
  server.registerTool(
    "unifi_net_list_firewall_zones",
    {
      title: "List firewall zones",
      description: "Lists all firewall zones on the current site (~6 expected).",
      inputSchema: pagShape,
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/firewall/zones`, { offset: a.offset, limit: a.limit, filter: a.filter }),
  );

  server.registerTool(
    "unifi_net_get_firewall_zone",
    {
      title: "Get firewall zone",
      description: "Detail for one firewall zone.",
      inputSchema: { id: z.string() },
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/firewall/zones/${a.id}`),
  );

  server.registerTool(
    "unifi_net_create_firewall_zone",
    {
      title: "Create firewall zone",
      description: "Creates a new firewall zone on the current site. Body shape per Firewall API docs.",
      inputSchema: { body: z.unknown().describe("Firewall zone create payload"), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => netWrite(ctx, a, "unifi_net_create_firewall_zone", "POST", (sid) => `/v1/sites/${sid}/firewall/zones`, a.body),
  );

  server.registerTool(
    "unifi_net_update_firewall_zone",
    {
      title: "Update firewall zone",
      description: "Updates an existing firewall zone.",
      inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_update_firewall_zone", "PUT", (sid) => `/v1/sites/${sid}/firewall/zones/${a.id}`, a.body),
  );

  server.registerTool(
    "unifi_net_delete_firewall_zone",
    {
      title: "Delete firewall zone",
      description: "Deletes a firewall zone. IRREVERSIBLE.",
      inputSchema: { id: z.string(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_delete_firewall_zone", "DELETE", (sid) => `/v1/sites/${sid}/firewall/zones/${a.id}`),
  );

  // --- Policies ---
  server.registerTool(
    "unifi_net_list_firewall_policies",
    {
      title: "List firewall policies",
      description: "Lists all firewall policies on the current site (~65 expected).",
      inputSchema: pagShape,
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/firewall/policies`, { offset: a.offset, limit: a.limit, filter: a.filter }),
  );

  server.registerTool(
    "unifi_net_get_firewall_policy",
    {
      title: "Get firewall policy",
      description: "Detail for one firewall policy.",
      inputSchema: { id: z.string() },
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/firewall/policies/${a.id}`),
  );

  server.registerTool(
    "unifi_net_create_firewall_policy",
    {
      title: "Create firewall policy",
      description: "Creates a new firewall policy on the current site. Body shape per Firewall API docs.",
      inputSchema: { body: z.unknown().describe("Firewall policy create payload"), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => netWrite(ctx, a, "unifi_net_create_firewall_policy", "POST", (sid) => `/v1/sites/${sid}/firewall/policies`, a.body),
  );

  server.registerTool(
    "unifi_net_update_firewall_policy",
    {
      title: "Update firewall policy",
      description: "Updates an existing firewall policy (full replacement).",
      inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_update_firewall_policy", "PUT", (sid) => `/v1/sites/${sid}/firewall/policies/${a.id}`, a.body),
  );

  server.registerTool(
    "unifi_net_patch_firewall_policy",
    {
      title: "Patch firewall policy",
      description: "Partially updates an existing firewall policy (PATCH semantics).",
      inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_patch_firewall_policy", "PATCH", (sid) => `/v1/sites/${sid}/firewall/policies/${a.id}`, a.body),
  );

  server.registerTool(
    "unifi_net_delete_firewall_policy",
    {
      title: "Delete firewall policy",
      description: "Deletes a firewall policy. IRREVERSIBLE.",
      inputSchema: { id: z.string(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_delete_firewall_policy", "DELETE", (sid) => `/v1/sites/${sid}/firewall/policies/${a.id}`),
  );

  // --- Ordering ---
  server.registerTool(
    "unifi_net_get_firewall_policy_ordering",
    {
      title: "Get firewall policy ordering",
      description: "Returns the current ordering of firewall policies on the current site.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => netGet(ctx, (sid) => `/v1/sites/${sid}/firewall/policies/ordering`),
  );

  server.registerTool(
    "unifi_net_reorder_firewall_policies",
    {
      title: "Reorder firewall policies",
      description: "Sets the ordering of firewall policies on the current site.",
      inputSchema: { body: z.unknown().describe("Policy ordering payload"), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_reorder_firewall_policies", "PUT", (sid) => `/v1/sites/${sid}/firewall/policies/ordering`, a.body),
  );
}
