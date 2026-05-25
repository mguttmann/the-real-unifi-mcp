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

export function registerWifiTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_wifi",
    { title: "List WiFi broadcasts", description: "WLAN broadcasts (~3 expected).", inputSchema: pagShape, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/wifi/broadcasts`, { offset: a.offset, limit: a.limit, filter: a.filter }),
  );
  server.registerTool(
    "unifi_net_get_wifi",
    { title: "Get WiFi broadcast", description: "Detail for a WLAN.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/wifi/broadcasts/${a.id}`),
  );
  server.registerTool(
    "unifi_net_create_wifi",
    {
      title: "Create WiFi broadcast",
      description: "Creates a new WLAN.",
      inputSchema: { body: z.unknown().describe("WiFi broadcast create payload"), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => netWrite(ctx, a, "unifi_net_create_wifi", "POST", (sid) => `/v1/sites/${sid}/wifi/broadcasts`, a.body),
  );
  server.registerTool(
    "unifi_net_update_wifi",
    {
      title: "Update WiFi broadcast",
      description: "Updates an existing WLAN.",
      inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_update_wifi", "PUT", (sid) => `/v1/sites/${sid}/wifi/broadcasts/${a.id}`, a.body),
  );
  server.registerTool(
    "unifi_net_delete_wifi",
    {
      title: "Delete WiFi broadcast",
      description: "Deletes a WLAN. IRREVERSIBLE.",
      inputSchema: { id: z.string(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_delete_wifi", "DELETE", (sid) => `/v1/sites/${sid}/wifi/broadcasts/${a.id}`),
  );
}
