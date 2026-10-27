import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult, apiPath } from "../helpers.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

async function netGetSite(
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

async function netGetRoot(
  ctx: ServerContext,
  path: string,
  query?: Record<string, string | number | undefined>,
) {
  try {
    const cid = await ctx.discovery.consoleId();
    const res = await ctx.client.requestNetwork("GET", cid, path, { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError)
      return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

export function registerSupportingTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_wans",
    {
      title: "List WANs",
      description: "WAN interfaces configured on the current site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGetSite(ctx, (sid) => apiPath`/v1/sites/${sid}/wans`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );
  server.registerTool(
    "unifi_net_list_site_to_site_vpn",
    {
      title: "List site-to-site VPN tunnels",
      description: "Site-to-site VPN tunnels configured on the current site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGetSite(ctx, (sid) => apiPath`/v1/sites/${sid}/vpn/site-to-site-tunnels`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );
  server.registerTool(
    "unifi_net_list_vpn_servers",
    {
      title: "List VPN servers",
      description: "VPN servers configured on the current site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGetSite(ctx, (sid) => apiPath`/v1/sites/${sid}/vpn/servers`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );
  server.registerTool(
    "unifi_net_list_radius_profiles",
    {
      title: "List RADIUS profiles",
      description: "RADIUS profiles configured on the current site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGetSite(ctx, (sid) => apiPath`/v1/sites/${sid}/radius/profiles`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );
  server.registerTool(
    "unifi_net_list_device_tags",
    {
      title: "List device tags",
      description: "Device tags configured on the current site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGetSite(ctx, (sid) => apiPath`/v1/sites/${sid}/device-tags`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );
  server.registerTool(
    "unifi_net_list_dpi_application_categories",
    {
      title: "List DPI application categories",
      description:
        "DPI application categories known to the UniFi Network API (console-level, no siteId required).",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGetRoot(ctx, `/v1/dpi/categories`, { offset: a.offset, limit: a.limit, filter: a.filter }),
  );
  server.registerTool(
    "unifi_net_list_dpi_applications",
    {
      title: "List DPI applications",
      description:
        "DPI applications known to the UniFi Network API (console-level, no siteId required).",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGetRoot(ctx, `/v1/dpi/applications`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );
  server.registerTool(
    "unifi_net_list_countries",
    {
      title: "List countries",
      description:
        "List of countries available in the UniFi Network API (console-level, no siteId required).",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGetRoot(ctx, `/v1/countries`, { offset: a.offset, limit: a.limit, filter: a.filter }),
  );
}
