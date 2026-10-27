import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { ServerContext } from "../../server.js";
import { apiPath } from "../helpers.js";
import { readOnly, pagShape, netGet, netGetRoot } from "./common.js";

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
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/wans`, {
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
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/vpn/site-to-site-tunnels`, {
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
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/vpn/servers`, {
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
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/radius/profiles`, {
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
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/device-tags`, {
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
