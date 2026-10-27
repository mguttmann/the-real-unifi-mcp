import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { apiPath } from "../helpers.js";
import { readOnly, netGet, lenientPagShape, lenientPagQuery } from "./common.js";

export function registerSwitchingTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_switch_stacks",
    {
      title: "List switch stacks",
      description: "Switch stacks configured on the current site.",
      inputSchema: z.object(lenientPagShape(200)),
      annotations: readOnly,
    },
    async (a) =>
      netGet(
        ctx,
        (sid) => apiPath`/v1/sites/${sid}/switching/switch-stacks`,
        lenientPagQuery(a, 200),
      ),
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
      inputSchema: z.object(lenientPagShape(200)),
      annotations: readOnly,
    },
    async (a) =>
      netGet(
        ctx,
        (sid) => apiPath`/v1/sites/${sid}/switching/mc-lag-domains`,
        lenientPagQuery(a, 200),
      ),
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
      inputSchema: z.object(lenientPagShape(200)),
      annotations: readOnly,
    },
    async (a) =>
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/switching/lags`, lenientPagQuery(a, 200)),
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
