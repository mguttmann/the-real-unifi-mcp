import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { apiErrorResult, jsonResult, lenientOptional, validOrUndefined } from "../helpers.js";
import { runGuarded } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";
import { networkPath, withQuery, type HttpMethod } from "../../client/unifiClient.js";

/**
 * Request helpers shared by the hand-written `unifi_net_*` tools (audit N-47):
 * one read path, one guarded write path, one error mapping (N-86) and one
 * preview URL builder (N-66), so a preview always names the request target.
 */

export const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;
export const writeOnce = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;
export const writeIdempotent = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** Paging params of the list tools that have had them since 0.2.0. */
export const pagShape = {
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
  filter: z.string().optional(),
};

const offsetSchema = z.number().int().nonnegative();
const filterSchema = z.string();

/**
 * Paging params added in 0.3.0 to list tools that had none (audit N-39). They
 * accept every value, as 0.2.1 did by stripping them; see `lenientOptional`.
 */
export function lenientPagShape(maxLimit: number) {
  return {
    offset: lenientOptional(offsetSchema, "Number of items to skip (vendor default 0)"),
    limit: lenientOptional(
      z.number().int().positive().max(maxLimit),
      `Items per page, at most ${maxLimit} (vendor default applies when unset)`,
    ),
    filter: lenientOptional(filterSchema, "Vendor filter expression"),
  };
}

/** Query of a lenient paging shape: values of the wrong type are left out. */
export function lenientPagQuery(
  a: { offset?: unknown; limit?: unknown; filter?: unknown },
  maxLimit: number,
): Record<string, unknown> {
  return {
    offset: validOrUndefined(offsetSchema, a.offset),
    limit: validOrUndefined(z.number().int().positive().max(maxLimit), a.limit),
    filter: validOrUndefined(filterSchema, a.filter),
  };
}

type Query = Record<string, unknown> | undefined;

async function read(
  ctx: ServerContext,
  docPath: () => Promise<string>,
  query: Query,
): Promise<CallToolResult> {
  try {
    const cid = await ctx.discovery.consoleId();
    const res = await ctx.client.requestNetwork("GET", cid, await docPath(), { query });
    return jsonResult(res.data, { pagination: res.pagination });
  } catch (err) {
    if (err instanceof UnifiApiError) return apiErrorResult(err);
    throw err;
  }
}

/** GET a path under the current Network site. */
export function netGet(
  ctx: ServerContext,
  path: (siteId: string) => string,
  query?: Query,
): Promise<CallToolResult> {
  return read(ctx, async () => path(await ctx.discovery.networkSiteId()), query);
}

/** GET a console-level path (no site id). */
export function netGetRoot(
  ctx: ServerContext,
  path: string,
  query?: Query,
): Promise<CallToolResult> {
  return read(ctx, async () => path, query);
}

/**
 * A guarded write under the current Network site: preview or execute through
 * `runGuarded`; the preview URL is the request target including the query.
 */
export async function netWrite(
  ctx: ServerContext,
  a: { confirm?: "YES" },
  toolName: string,
  method: Exclude<HttpMethod, "GET">,
  path: (siteId: string) => string,
  body?: unknown,
  query?: Query,
): Promise<CallToolResult> {
  try {
    const [cid, sid] = await Promise.all([
      ctx.discovery.consoleId(),
      ctx.discovery.networkSiteId(),
    ]);
    const docPath = path(sid);
    const url = withQuery(networkPath(cid, docPath), query);
    return await runGuarded(ctx.cfg, a, { toolName, method, url, body }, async () => {
      try {
        const res = await ctx.client.requestNetwork(method, cid, docPath, { body, query });
        return jsonResult(res.data);
      } catch (err) {
        if (err instanceof UnifiApiError) return apiErrorResult(err);
        throw err;
      }
    });
  } catch (err) {
    if (err instanceof UnifiApiError) return apiErrorResult(err);
    throw err;
  }
}
