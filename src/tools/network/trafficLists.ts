import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult, apiPath } from "../helpers.js";
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
const writeIdempotent = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

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
  const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
  return runGuarded(ctx.cfg, a, { toolName, method, url: fullUrl, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, cid, docPath, { body });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError)
        return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerTrafficListTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_traffic_lists",
    {
      title: "List traffic matching lists",
      description: "Lists all traffic matching lists configured on the current site.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/traffic-matching-lists`),
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
