import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

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

export function registerAclTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_acl_rules",
    {
      title: "List ACL rules",
      description: "Lists all ACL rules on the current site.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => netGet(ctx, (sid) => `/v1/sites/${sid}/acl-rules`),
  );

  server.registerTool(
    "unifi_net_get_acl_rule",
    {
      title: "Get ACL rule",
      description: "Detail for one ACL rule on the current site.",
      inputSchema: { id: z.string() },
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/acl-rules/${a.id}`),
  );

  server.registerTool(
    "unifi_net_create_acl_rule",
    {
      title: "Create ACL rule",
      description: "Creates a new ACL rule on the current site. Body shape per ACL API docs.",
      inputSchema: { body: z.unknown().describe("ACL rule create payload"), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => netWrite(ctx, a, "unifi_net_create_acl_rule", "POST", (sid) => `/v1/sites/${sid}/acl-rules`, a.body),
  );

  server.registerTool(
    "unifi_net_update_acl_rule",
    {
      title: "Update ACL rule",
      description: "Updates an existing ACL rule on the current site (full replacement).",
      inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_update_acl_rule", "PUT", (sid) => `/v1/sites/${sid}/acl-rules/${a.id}`, a.body),
  );

  server.registerTool(
    "unifi_net_delete_acl_rule",
    {
      title: "Delete ACL rule",
      description: "Deletes an ACL rule on the current site. IRREVERSIBLE.",
      inputSchema: { id: z.string(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_delete_acl_rule", "DELETE", (sid) => `/v1/sites/${sid}/acl-rules/${a.id}`),
  );

  server.registerTool(
    "unifi_net_get_acl_rule_ordering",
    {
      title: "Get ACL rule ordering",
      description: "Returns the current ordering of ACL rules on the current site.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => netGet(ctx, (sid) => `/v1/sites/${sid}/acl-rules/ordering`),
  );

  server.registerTool(
    "unifi_net_reorder_acl_rules",
    {
      title: "Reorder ACL rules",
      description: "Sets the ordering of ACL rules on the current site.",
      inputSchema: { body: z.unknown().describe("ACL rule ordering payload"), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_reorder_acl_rules", "PUT", (sid) => `/v1/sites/${sid}/acl-rules/ordering`, a.body),
  );
}
