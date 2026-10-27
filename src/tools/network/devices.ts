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
const writeIdempotent = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

async function getAt(
  ctx: ServerContext,
  method: "GET" | "POST" | "DELETE",
  path: (siteId: string) => string,
  body?: unknown,
) {
  try {
    const [cid, sid] = await Promise.all([
      ctx.discovery.consoleId(),
      ctx.discovery.networkSiteId(),
    ]);
    const res = await ctx.client.requestNetwork(method, cid, path(sid), { body });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError)
      return errorResult(err.message, { statusCode: err.statusCode });
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
      description: "Adopted UniFi devices on the current site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) => {
      try {
        const [cid, sid] = await Promise.all([
          ctx.discovery.consoleId(),
          ctx.discovery.networkSiteId(),
        ]);
        const res = await ctx.client.requestNetwork("GET", cid, apiPath`/v1/sites/${sid}/devices`, {
          query: { offset: a.offset, limit: a.limit, filter: a.filter },
        });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError)
          return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );

  server.registerTool(
    "unifi_net_get_device",
    {
      title: "Get device details",
      description: "Detail for a single adopted device.",
      inputSchema: z.object({ deviceId: z.string() }),
      annotations: readOnly,
    },
    async (a) => getAt(ctx, "GET", (sid) => apiPath`/v1/sites/${sid}/devices/${a.deviceId}`),
  );

  server.registerTool(
    "unifi_net_get_device_stats",
    {
      title: "Get latest device statistics",
      description: "Latest statistics snapshot.",
      inputSchema: z.object({ deviceId: z.string() }),
      annotations: readOnly,
    },
    async (a) =>
      getAt(ctx, "GET", (sid) => apiPath`/v1/sites/${sid}/devices/${a.deviceId}/statistics/latest`),
  );

  server.registerTool(
    "unifi_net_list_pending_devices",
    {
      title: "List pending devices",
      description: "Devices waiting to be adopted (console-level, no siteId required).",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) => {
      try {
        const cid = await ctx.discovery.consoleId();
        const res = await ctx.client.requestNetwork("GET", cid, `/v1/pending-devices`, {
          query: { offset: a.offset, limit: a.limit, filter: a.filter },
        });
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError)
          return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }
    },
  );

  server.registerTool(
    "unifi_net_adopt_devices",
    {
      title: "Adopt pending devices",
      description:
        "Adopts pending devices by MAC. Sends one adoption request per MAC and reports the result per MAC.",
      inputSchema: z.object({
        macs: z.array(z.string()).min(1).describe("Device MAC addresses to adopt"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([
        ctx.discovery.consoleId(),
        ctx.discovery.networkSiteId(),
      ]);
      // The vendor adopts one device per call: POST /v1/sites/{siteId}/devices
      // with {macAddress, ignoreDeviceLimit} (audit M-5).
      const docPath = apiPath`/v1/sites/${sid}/devices`;
      const bodies = a.macs.map((mac) => ({ macAddress: mac, ignoreDeviceLimit: false }));
      const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
      return runGuarded(
        ctx.cfg,
        a,
        { toolName: "unifi_net_adopt_devices", method: "POST", url: fullUrl, body: bodies },
        async () => {
          const results: Array<{
            mac: string;
            ok: boolean;
            data?: unknown;
            error?: string;
            statusCode?: number;
          }> = [];
          for (const body of bodies) {
            try {
              const res = await ctx.client.requestNetwork("POST", cid, docPath, { body });
              results.push({ mac: body.macAddress, ok: true, data: res.data });
            } catch (err) {
              if (!(err instanceof UnifiApiError)) throw err;
              results.push({
                mac: body.macAddress,
                ok: false,
                error: err.message,
                statusCode: err.statusCode,
              });
            }
          }
          const failed = results.filter((r) => !r.ok).length;
          if (failed > 0)
            return errorResult(`${failed} of ${results.length} adoptions failed`, { results });
          return jsonResult({ results });
        },
      );
    },
  );

  server.registerTool(
    "unifi_net_device_action",
    {
      title: "Execute device action",
      description:
        'Generic device action. Uses the `executeadopteddeviceaction` endpoint. Vendor value: RESTART (lowercase "restart" is mapped).',
      inputSchema: z.object({
        deviceId: z.string(),
        action: z.string().describe('e.g. "RESTART"'),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([
        ctx.discovery.consoleId(),
        ctx.discovery.networkSiteId(),
      ]);
      const docPath = apiPath`/v1/sites/${sid}/devices/${a.deviceId}/actions`;
      const body = { action: vendorAction(a.action) };
      const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
      return runGuarded(
        ctx.cfg,
        a,
        { toolName: "unifi_net_device_action", method: "POST", url: fullUrl, body },
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
    "unifi_net_reboot_device",
    {
      title: "Reboot device",
      description: "Convenience wrapper over device_action with action=RESTART.",
      inputSchema: z.object({ deviceId: z.string(), ...confirmShape }),
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([
        ctx.discovery.consoleId(),
        ctx.discovery.networkSiteId(),
      ]);
      const docPath = apiPath`/v1/sites/${sid}/devices/${a.deviceId}/actions`;
      const body = { action: "RESTART" };
      const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
      return runGuarded(
        ctx.cfg,
        a,
        { toolName: "unifi_net_reboot_device", method: "POST", url: fullUrl, body },
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
    "unifi_net_port_action",
    {
      title: "Execute switch port action",
      description:
        'Action on a switch port. Vendor value: POWER_CYCLE (PoE power-cycle; "power-cycle" is mapped).',
      inputSchema: z.object({
        deviceId: z.string(),
        portIdx: z.number().int(),
        action: z.string().describe('e.g. "POWER_CYCLE"'),
        body: z.unknown().optional().describe("Extra action payload"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([
        ctx.discovery.consoleId(),
        ctx.discovery.networkSiteId(),
      ]);
      const docPath = apiPath`/v1/sites/${sid}/devices/${a.deviceId}/interfaces/ports/${a.portIdx}/actions`;
      const body = {
        action: vendorAction(a.action),
        ...(a.body as Record<string, unknown> | undefined),
      };
      const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
      return runGuarded(
        ctx.cfg,
        a,
        { toolName: "unifi_net_port_action", method: "POST", url: fullUrl, body },
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
    "unifi_net_remove_device",
    {
      title: "Remove (unadopt) device",
      description: "Removes an adopted device from the site.",
      inputSchema: z.object({ deviceId: z.string(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) => {
      const [cid, sid] = await Promise.all([
        ctx.discovery.consoleId(),
        ctx.discovery.networkSiteId(),
      ]);
      const docPath = apiPath`/v1/sites/${sid}/devices/${a.deviceId}`;
      const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}`;
      return runGuarded(
        ctx.cfg,
        a,
        { toolName: "unifi_net_remove_device", method: "DELETE", url: fullUrl },
        async () => {
          try {
            const res = await ctx.client.requestNetwork("DELETE", cid, docPath);
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
}
