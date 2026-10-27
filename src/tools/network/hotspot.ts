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
  method: "POST" | "DELETE",
  pathBuilder: (sid: string) => string,
  body?: unknown,
  query?: Record<string, string>,
) {
  const [cid, sid] = await Promise.all([ctx.discovery.consoleId(), ctx.discovery.networkSiteId()]);
  const docPath = pathBuilder(sid);
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  const fullUrl = `/v1/connector/consoles/${cid}/proxy/network/integration${docPath}${qs}`;
  return runGuarded(ctx.cfg, a, { toolName, method, url: fullUrl, body }, async () => {
    try {
      const res = await ctx.client.requestNetwork(method, cid, docPath, { body, query });
      return jsonResult(res.data);
    } catch (err) {
      if (err instanceof UnifiApiError)
        return errorResult(err.message, { statusCode: err.statusCode });
      throw err;
    }
  });
}

export function registerHotspotTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_vouchers",
    {
      title: "List vouchers",
      description: "Hotspot vouchers configured on the current site.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/hotspot/vouchers`),
  );
  server.registerTool(
    "unifi_net_get_voucher",
    {
      title: "Get voucher",
      description: "Hotspot voucher detail for a single voucher.",
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/hotspot/vouchers/${a.id}`),
  );
  server.registerTool(
    "unifi_net_create_vouchers",
    {
      title: "Create vouchers",
      description:
        "Generates one or more hotspot vouchers. Body shape per UniFi docs (count, name, duration, …).",
      inputSchema: z.object({
        body: z.unknown().optional().describe("Voucher generation payload"),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_create_vouchers",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/hotspot/vouchers`,
        a.body,
      ),
  );
  server.registerTool(
    "unifi_net_delete_voucher",
    {
      title: "Delete voucher",
      description: "Deletes a single hotspot voucher.",
      inputSchema: z.object({ id: z.string(), ...confirmShape }),
      annotations: writeIdempotent,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_delete_voucher",
        "DELETE",
        (sid) => apiPath`/v1/sites/${sid}/hotspot/vouchers/${a.id}`,
      ),
  );
  server.registerTool(
    "unifi_net_delete_vouchers",
    {
      title: "Delete vouchers",
      description:
        "Deletes all vouchers matching `filter` (required by the API, sent as query parameter). `body.filter` is still accepted for compatibility.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("Voucher filter expression, sent as the `filter` query parameter"),
        body: z
          .unknown()
          .optional()
          .describe("Deprecated: { filter } is read from here when `filter` is not set"),
        ...confirmShape,
      }),
      annotations: writeIdempotent,
    },
    async (a) => {
      // The vendor reads the filter from the query string, not from a DELETE body (audit N-7).
      const legacy = (a.body as { filter?: unknown } | undefined)?.filter;
      const filter = a.filter ?? (typeof legacy === "string" ? legacy : undefined);
      if (!filter)
        return errorResult(
          "unifi_net_delete_vouchers needs `filter`; refusing to send a bulk delete without one. No request was sent.",
        );
      return netWrite(
        ctx,
        a,
        "unifi_net_delete_vouchers",
        "DELETE",
        (sid) => apiPath`/v1/sites/${sid}/hotspot/vouchers`,
        undefined,
        { filter },
      );
    },
  );
}
