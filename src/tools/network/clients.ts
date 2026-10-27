import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult, apiPath, vendorAction } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;
const writeOnce = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;

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
    const [cid, sid] = await Promise.all([
      ctx.discovery.consoleId(),
      ctx.discovery.networkSiteId(),
    ]);
    const res = await ctx.client.requestNetwork("GET", cid, path(sid), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError)
      return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

/**
 * The vendor client action discriminator only knows AUTHORIZE_GUEST_ACCESS and
 * UNAUTHORIZE_GUEST_ACCESS. Block/unblock have no endpoint, so the tools stay
 * registered (tool contract) but refuse without a request (audit N-6).
 */
function notSupported(toolName: string) {
  return errorResult(
    `${toolName} is not supported: the UniFi Network API has no block/unblock action for clients (only AUTHORIZE_GUEST_ACCESS and UNAUTHORIZE_GUEST_ACCESS via unifi_net_client_action). No request was sent.`,
  );
}

export function registerClientTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_clients",
    {
      title: "List connected clients",
      description: "Currently connected clients on the site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/clients`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );

  server.registerTool(
    "unifi_net_get_client",
    {
      title: "Get connected client",
      description: "Detail for a connected client by id.",
      inputSchema: z.object({ clientId: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/clients/${a.clientId}`),
  );

  server.registerTool(
    "unifi_net_client_action",
    {
      title: "Execute client action",
      description:
        "Action on a connected client. Vendor values: AUTHORIZE_GUEST_ACCESS, UNAUTHORIZE_GUEST_ACCESS (lowercase and dashes are mapped). The Network API has no block/unblock action.",
      inputSchema: z.object({
        clientId: z.string(),
        action: z.string().describe('e.g. "AUTHORIZE_GUEST_ACCESS", "UNAUTHORIZE_GUEST_ACCESS"'),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([
        ctx.discovery.consoleId(),
        ctx.discovery.networkSiteId(),
      ]);
      const docPath = apiPath`/v1/sites/${sid}/clients/${a.clientId}/actions`;
      const body = { action: vendorAction(a.action) };
      const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
      return runGuarded(
        ctx.cfg,
        a,
        { toolName: "unifi_net_client_action", method: "POST", url: fullUrl, body },
        async () => {
          try {
            const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
            return jsonResult(res.data);
          } catch (err) {
            if (err instanceof UnifiApiError)
              return errorResult(err.message, { statusCode: err.statusCode });
            throw err;
          }
        },
      );
    },
  );

  server.registerTool(
    "unifi_net_block_client",
    {
      title: "Block client",
      description:
        "Not supported: the UniFi Network API defines no block action for clients, so this tool returns an error and sends nothing. Kept for compatibility.",
      inputSchema: z.object({ clientId: z.string(), ...confirmShape }),
      annotations: writeOnce,
    },
    async () => notSupported("unifi_net_block_client"),
  );

  server.registerTool(
    "unifi_net_unblock_client",
    {
      title: "Unblock client",
      description:
        "Not supported: the UniFi Network API defines no unblock action for clients, so this tool returns an error and sends nothing. Kept for compatibility.",
      inputSchema: z.object({ clientId: z.string(), ...confirmShape }),
      annotations: writeOnce,
    },
    async () => notSupported("unifi_net_unblock_client"),
  );
}
