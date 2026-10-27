import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult, apiPath } from "../helpers.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
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

export function registerSwitchingTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_switch_stacks",
    {
      title: "List switch stacks",
      description: "Switch stacks configured on the current site.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/switching/switch-stacks`),
  );
  server.registerTool(
    "unifi_net_get_switch_stack",
    {
      title: "Get switch stack",
      description: "Switch stack detail for a single stack.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/switching/switch-stacks/${a.id}`),
  );
  server.registerTool(
    "unifi_net_list_mclag_domains",
    {
      title: "List MCLAG domains",
      description: "MCLAG domains configured on the current site.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/switching/mc-lag-domains`),
  );
  server.registerTool(
    "unifi_net_get_mclag_domain",
    {
      title: "Get MCLAG domain",
      description: "MCLAG domain detail for a single domain.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/switching/mc-lag-domains/${a.id}`),
  );
  server.registerTool(
    "unifi_net_list_lags",
    {
      title: "List LAGs",
      description: "Link Aggregation Groups (LAGs) configured on the current site.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/switching/lags`),
  );
  server.registerTool(
    "unifi_net_get_lag",
    {
      title: "Get LAG",
      description: "Link Aggregation Group (LAG) detail for a single LAG.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/switching/lags/${a.id}`),
  );
}
