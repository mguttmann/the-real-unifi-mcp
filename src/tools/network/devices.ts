import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const writeOnce = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;
const writeIdempotent = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

async function getAt(
  ctx: ServerContext,
  method: "GET" | "POST" | "DELETE",
  path: (siteId: string) => string,
  body?: unknown,
) {
  try {
    const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
    const res = await ctx.client.requestNetwork(method, cid, path(sid), { body });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
    throw err;
  }
}

const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

export function registerDeviceTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_devices",
    {
      title: "List adopted devices",
      description: "Adopted UniFi devices on the current site. Plausibility anchor: ~16 devices.",
      inputSchema: pagShape,
      annotations: readOnly,
    },
    async (a) => {
      try {
        const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
        const res = await ctx.client.requestNetwork("GET", cid, `/v1/sites/${sid}/devices`, {
          query: { offset: a.offset, limit: a.limit, filter: a.filter },
        });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );

  server.registerTool(
    "unifi_net_get_device",
    {
      title: "Get device details",
      description: "Detail for a single adopted device.",
      inputSchema: { deviceId: z.string() },
      annotations: readOnly,
    },
    async (a) => getAt(ctx, "GET", (sid) => `/v1/sites/${sid}/devices/${a.deviceId}`),
  );

  server.registerTool(
    "unifi_net_get_device_stats",
    {
      title: "Get latest device statistics",
      description: "Latest statistics snapshot.",
      inputSchema: { deviceId: z.string() },
      annotations: readOnly,
    },
    async (a) => getAt(ctx, "GET", (sid) => `/v1/sites/${sid}/devices/${a.deviceId}/statistics/latest`),
  );

  server.registerTool(
    "unifi_net_list_pending_devices",
    {
      title: "List pending devices",
      description: "Devices waiting to be adopted.",
      inputSchema: pagShape,
      annotations: readOnly,
    },
    async (a) => {
      try {
        const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
        const res = await ctx.client.requestNetwork("GET", cid, `/v1/sites/${sid}/devices/pending`, {
          query: { offset: a.offset, limit: a.limit, filter: a.filter },
        });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );

  server.registerTool(
    "unifi_net_adopt_devices",
    {
      title: "Adopt pending devices",
      description: "Adopts pending devices by MAC.",
      inputSchema: {
        macs: z.array(z.string()).min(1).describe("Device MAC addresses to adopt"),
        ...confirmShape,
      },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/devices/actions/adopt`;
      const body = { macs: a.macs };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_adopt_devices", method: "POST", url: docPath, body }, async () => {
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
    "unifi_net_device_action",
    {
      title: "Execute device action",
      description: "Generic device action (e.g. reboot, restart). Uses the `executeadopteddeviceaction` endpoint.",
      inputSchema: {
        deviceId: z.string(),
        action: z.string().describe('e.g. "restart"'),
        ...confirmShape,
      },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/devices/${a.deviceId}/actions`;
      const body = { action: a.action };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_device_action", method: "POST", url: docPath, body }, async () => {
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
    "unifi_net_reboot_device",
    {
      title: "Reboot device",
      description: "Convenience wrapper over device_action with action=restart.",
      inputSchema: { deviceId: z.string(), ...confirmShape },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/devices/${a.deviceId}/actions`;
      const body = { action: "restart" };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_reboot_device", method: "POST", url: docPath, body }, async () => {
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
    "unifi_net_port_action",
    {
      title: "Execute switch port action",
      description: "Power-cycle or set port profile on a switch port.",
      inputSchema: {
        deviceId: z.string(),
        portIdx: z.number().int(),
        action: z.string().describe('e.g. "power-cycle"'),
        body: z.unknown().optional().describe("Extra action payload"),
        ...confirmShape,
      },
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/devices/${a.deviceId}/interfaces/ports/${a.portIdx}/actions`;
      const body = { action: a.action, ...(a.body as Record<string, unknown> | undefined) };
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_port_action", method: "POST", url: docPath, body }, async () => {
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
    "unifi_net_remove_device",
    {
      title: "Remove (unadopt) device",
      description: "Removes an adopted device from the site.",
      inputSchema: { deviceId: z.string(), ...confirmShape },
      annotations: writeIdempotent,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      const docPath = `/v1/sites/${sid}/devices/${a.deviceId}`;
      return runGuarded(ctx.cfg, a, { toolName: "unifi_net_remove_device", method: "DELETE", url: docPath }, async () => {
        try {
          const res = await ctx.client.requestNetwork("DELETE", cid, docPath);
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });
    },
  );
}
