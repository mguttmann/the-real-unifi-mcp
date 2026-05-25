import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGet(
  ctx: ServerContext,
  path: (sid: string) => string,
  query?: Record<string, string | number | undefined>,
) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

export function registerClientTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_clients",
    {
      title: "List connected clients",
      description: "Currently connected clients on the site (~8 expected).",
      inputSchema: pagShape,
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/clients`, { offset: a.offset, limit: a.limit, filter: a.filter }),
  );

  server.registerTool(
    "unifi_net_get_client",
    {
      title: "Get connected client",
      description: "Detail for a connected client by id.",
      inputSchema: { clientId: z.string() },
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/clients/${a.clientId}`),
  );

  server.registerTool(
    "unifi_net_client_action",
    {
      title: "Execute client action",
      description: "Action on a connected client (e.g. block/unblock/reconnect).",
      inputSchema: {
        clientId: z.string(),
        action: z.string().describe('e.g. "block", "unblock", "reconnect"'),
        ...confirmShape,
      },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/clients/${a.clientId}/actions`;
      const body = { action: a.action };
      const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_client_action", method: "POST", url: fullUrl, body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );

  server.registerTool(
    "unifi_net_block_client",
    {
      title: "Block client",
      description: "Convenience wrapper: client_action with action=block.",
      inputSchema: { clientId: z.string(), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/clients/${a.clientId}/actions`;
      const body = { action: "block" };
      const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_block_client", method: "POST", url: fullUrl, body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );

  server.registerTool(
    "unifi_net_unblock_client",
    {
      title: "Unblock client",
      description: "Convenience wrapper: client_action with action=unblock.",
      inputSchema: { clientId: z.string(), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/clients/${a.clientId}/actions`;
      const body = { action: "unblock" };
      const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_unblock_client", method: "POST", url: fullUrl, body }, async () => {
        try {
          const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
