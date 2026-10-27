import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult, apiErrorResult, apiPath, vendorAction } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { networkPath } from "../../client/unifiClient.js";
import {
  readOnly,
  writeOnce,
  writeIdempotent,
  pagShape,
  netGet,
  netGetRoot,
  netWrite,
} from "./common.js";

export function registerDeviceTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_devices",
    {
      title: "List adopted devices",
      description: "Adopted UniFi devices on the current site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/devices`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );

  server.registerTool(
    "unifi_net_get_device",
    {
      title: "Get device details",
      description: "Detail for a single adopted device.",
      inputSchema: z.object({ deviceId: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/devices/${a.deviceId}`),
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
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/devices/${a.deviceId}/statistics/latest`),
  );

  server.registerTool(
    "unifi_net_list_pending_devices",
    {
      title: "List pending devices",
      description: "Devices waiting to be adopted (console-level, no siteId required).",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGetRoot(ctx, `/v1/pending-devices`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
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
      let cid: string;
      let sid: string;
      try {
        [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
      } catch (err) {
        if (err instanceof UnifiApiError) return apiErrorResult(err);
        throw err;
      }
      // The vendor adopts one device per call: POST /v1/sites/{siteId}/devices
      // with {macAddress, ignoreDeviceLimit} (audit M-5).
      const docPath = apiPath`/v1/sites/${sid}/devices`;
      const bodies = a.macs.map((mac) => ({ macAddress: mac, ignoreDeviceLimit: false }));
      return runGuarded(
        ctx.cfg,
        a,
        {
          toolName: "unifi_net_adopt_devices",
          method: "POST",
          url: networkPath(cid, docPath),
          body: bodies,
        },
        async () => {
          const results: Array<{
            mac: string;
            ok: boolean;
            data?: unknown;
            error?: string;
            statusCode?: number;
            code?: string;
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
                code: err.code,
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
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_device_action",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/devices/${a.deviceId}/actions`,
        { action: vendorAction(a.action) },
      ),
  );

  server.registerTool(
    "unifi_net_reboot_device",
    {
      title: "Reboot device",
      description: "Convenience wrapper over device_action with action=RESTART.",
      inputSchema: z.object({ deviceId: z.string(), ...confirmShape }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_reboot_device",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/devices/${a.deviceId}/actions`,
        { action: "RESTART" },
      ),
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
        body: z
          .unknown()
          .optional()
          .describe("Extra action payload; its `action` key is ignored, `action` above wins"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_port_action",
        "POST",
        (sid) =>
          apiPath`/v1/sites/${sid}/devices/${a.deviceId}/interfaces/ports/${a.portIdx}/actions`,
        // The mapped action goes last, so `body.action` cannot replace it (audit N-65).
        { ...(a.body as Record<string, unknown> | undefined), action: vendorAction(a.action) },
      ),
  );

  server.registerTool(
    "unifi_net_remove_device",
    {
      title: "Remove (unadopt) device",
      description: "Removes an adopted device from the site.",
      inputSchema: z.object({ deviceId: z.string(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_remove_device",
        "DELETE",
        (sid) => apiPath`/v1/sites/${sid}/devices/${a.deviceId}`,
      ),
  );
}
