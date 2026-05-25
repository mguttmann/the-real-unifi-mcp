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
  method: "POST" | "PUT" | "DELETE",
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

export function registerNetworkTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_networks",
    { title: "List networks", description: "Networks configured on the current site (~3 expected).", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/networks`, { offset: a.offset, limit: a.limit, filter: a.filter }),
  );
  server.registerTool(
    "unifi_net_get_network",
    { title: "Get network", description: "Detail for one network.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/networks/${a.id}`),
  );
  server.registerTool(
    "unifi_net_get_network_references",
    { title: "Get network references", description: "References to this network from other objects.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/networks/${a.id}/references`),
  );
  server.registerTool(
    "unifi_net_create_network",
    {
      title: "Create network",
      description: "Creates a new network on the current site. Body shape per Network API docs.",
      inputSchema: { body: z.unknown().describe("Network create payload"), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => netWrite(ctx, a, "unifi_net_create_network", "POST", (sid) => `/v1/sites/${sid}/networks`, a.body),
  );
  server.registerTool(
    "unifi_net_update_network",
    {
      title: "Update network",
      description: "Updates an existing network.",
      inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_update_network", "PUT", (sid) => `/v1/sites/${sid}/networks/${a.id}`, a.body),
  );
  server.registerTool(
    "unifi_net_delete_network",
    {
      title: "Delete network",
      description: "Deletes a network. IRREVERSIBLE.",
      inputSchema: { id: z.string(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_delete_network", "DELETE", (sid) => `/v1/sites/${sid}/networks/${a.id}`),
  );
}
