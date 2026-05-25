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
      if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerDnsTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_dns_policies",
    { title: "List DNS policies", description: "Lists all DNS policies configured on the current site.", inputSchema: {}, annotations: readOnly },
    async () => netGet(ctx, (sid) => `/v1/sites/${sid}/dns/policies`),
  );
  server.registerTool(
    "unifi_net_get_dns_policy",
    { title: "Get DNS policy", description: "Detail for one DNS policy.", inputSchema: { id: z.string() }, annotations: readOnly },
    async (a) => netGet(ctx, (sid) => `/v1/sites/${sid}/dns/policies/${a.id}`),
  );
  server.registerTool(
    "unifi_net_create_dns_policy",
    {
      title: "Create DNS policy",
      description: "Creates a new DNS policy on the current site. Body shape per Network API docs.",
      inputSchema: { body: z.unknown().describe("DNS policy create payload"), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => netWrite(ctx, a, "unifi_net_create_dns_policy", "POST", (sid) => `/v1/sites/${sid}/dns/policies`, a.body),
  );
  server.registerTool(
    "unifi_net_update_dns_policy",
    {
      title: "Update DNS policy",
      description: "Updates an existing DNS policy.",
      inputSchema: { id: z.string(), body: z.unknown(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_update_dns_policy", "PUT", (sid) => `/v1/sites/${sid}/dns/policies/${a.id}`, a.body),
  );
  server.registerTool(
    "unifi_net_delete_dns_policy",
    {
      title: "Delete DNS policy",
      description: "Deletes a DNS policy. IRREVERSIBLE.",
      inputSchema: { id: z.string(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => netWrite(ctx, a, "unifi_net_delete_dns_policy", "DELETE", (sid) => `/v1/sites/${sid}/dns/policies/${a.id}`),
  );
}
