import type { DocSchema, EndpointSpec } from "./openapi.js";
import { docText, schemaToZodSource } from "./schemaFromDoc.js";

export interface EmitInput {
  toolName: string;
  surface: "siteManager" | "network";
  docPath: string;
  endpoint: EndpointSpec;
  /** `components.schemas` of the vendor document, for typed request bodies. */
  refs: Record<string, DocSchema>;
  /** Last vendor doc version that has the operation, when the vendor removed it. */
  removedUpstream?: string;
  /** Site list with `data[].statistics`: adds `includeStatistics` (see catalog.ts). */
  siteStatistics?: true;
}

const BODY_TEXT =
  "JSON request body, sent as is. Top-level vendor fields only; full schema: vendor docs page in the description.";

const READ_ONLY = `{ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }`;
const WRITE_ONCE = `{ readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }`;
const WRITE_IDEMP = `{ readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }`;

/**
 * Tools whose method suggests a write but which only read (audit N-27): the
 * ISP metrics query POSTs a time window, like its hand-written twin
 * `unifi_sm_query_isp_metrics`. Annotations only; the confirm guard stays.
 */
export const READ_ONLY_OVERRIDES: ReadonlySet<string> = new Set(["unifi_gen_queryispmetrics"]);

function annotationFor(method: EndpointSpec["method"], toolName: string): string {
  if (method === "GET" || READ_ONLY_OVERRIDES.has(toolName)) return READ_ONLY;
  if (method === "POST") return WRITE_ONCE;
  return WRITE_IDEMP;
}

function buildInputShape(
  ep: EndpointSpec,
  isWrite: boolean,
  refs: Record<string, DocSchema>,
  siteStatistics: boolean,
): string {
  const parts: string[] = [];
  const params = ep.parameters ?? [];
  for (const p of params) {
    // siteId is auto-resolved from discovery; never exposed to caller
    if (p.name === "siteId") continue;
    const base = schemaToZodSource(p.schema as Record<string, unknown> | undefined);
    const desc = p.description ? `.describe(${JSON.stringify(docText(p.description))})` : "";
    const opt = p.required ? "" : ".optional()";
    const safe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p.name) ? p.name : JSON.stringify(p.name);
    parts.push(`${safe}: ${base}${desc}${opt}`);
  }
  if (ep.requestBody) {
    // N-37: typed after the vendor schema for documentation, but a union with
    // z.unknown(), so every value 0.2.1 accepted still passes, unchanged.
    // Optional even when the vendor requires a body: zod 3 left z.unknown()
    // keys optional and v0.1.2 published that contract (audit M-1).
    const typed = schemaToZodSource(ep.requestBody.schema as DocSchema | undefined, refs, {
      loose: true,
    });
    const text = BODY_TEXT + (ep.requestBody.required ? " The API requires a body." : "");
    const base = typed === "z.unknown()" ? typed : `z.union([${typed}, z.unknown()])`;
    parts.push(`body: ${base}.describe(${JSON.stringify(text)}).optional()`);
  }
  if (siteStatistics) parts.push(`includeStatistics: includeStatisticsParam`);
  if (isWrite) parts.push(`...confirmShape`);
  return `{${parts.join(", ")}}`;
}

function pathTemplate(path: string, surface: "siteManager" | "network"): string {
  const siteIdResolver =
    surface === "network"
      ? "await ctx.discovery.networkSiteId()"
      : "await ctx.discovery.siteManagerSiteId()";
  return path.replace(/\{([^}]+)\}/g, (_, n) => {
    if (n === "siteId") return `\${encodeURIComponent(String(${siteIdResolver}))}`;
    return `\${encodeURIComponent(String(a.${n}))}`;
  });
}

function queryPicker(ep: EndpointSpec): string {
  const queryParams = (ep.parameters ?? []).filter((p) => p.in === "query" && p.name !== "siteId");
  if (queryParams.length === 0) return "undefined";
  const entries = queryParams.map((p) => {
    const isIdent = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p.name);
    const safe = isIdent ? p.name : JSON.stringify(p.name);
    const accessor = isIdent ? `a.${p.name}` : `a[${safe}]`;
    return `${safe}: ${accessor}`;
  });
  return `{${entries.join(", ")}}`;
}

export function emitToolFile(input: EmitInput): string {
  const { toolName, surface, docPath, endpoint, refs, removedUpstream } = input;
  const method = endpoint.method;
  const isWrite = method !== "GET";
  const siteStatistics = input.siteStatistics === true;
  if (siteStatistics && isWrite) throw new Error(`${toolName}: siteStatistics on a write tool`);
  const removedNote = removedUpstream
    ? ` Removed from the vendor docs after ${removedUpstream}; kept for compatibility, answers REMOVED_UPSTREAM when the console no longer has the endpoint.`
    : "";
  const description = docText(
    `${endpoint.summary ?? endpoint.description ?? toolName} - generated from developer.ui.com/${docPath}${removedNote}`,
  );
  const inputShape = buildInputShape(endpoint, isWrite, refs, siteStatistics);
  const annotation = annotationFor(method, toolName);

  const path = endpoint.path;
  const pathExpr = `\`${pathTemplate(path, surface)}\``;
  const queryExpr = queryPicker(endpoint);
  const bodyExpr = endpoint.requestBody ? "a.body" : "undefined";

  const callExpr =
    surface === "network"
      ? `await ctx.client.requestNetwork("${method}", await ctx.discovery.consoleId(), ${pathExpr}, { body: ${bodyExpr}, query: ${queryExpr} })`
      : `await ctx.client.request("${method}", ${pathExpr}, { body: ${bodyExpr}, query: ${queryExpr} })`;

  // The preview names the request target: console id encoded like the
  // request (N-66) and the query as sent (N-26).
  const guardUrlExpr =
    surface === "network"
      ? `withQuery(networkPath(await ctx.discovery.consoleId(), ${pathExpr}), ${queryExpr})`
      : `withQuery(${pathExpr}, ${queryExpr})`;

  const catchApiError = (indent: string): string =>
    (removedUpstream
      ? `if (err instanceof UnifiApiError && err.statusCode === 404) return removedUpstreamResult(${JSON.stringify(toolName)}, ${JSON.stringify(removedUpstream)});\n${indent}`
      : "") + `if (err instanceof UnifiApiError) return apiErrorResult(err);`;

  const handlerBody = isWrite
    ? `
      return runGuarded(ctx.cfg, a, { toolName: ${JSON.stringify(toolName)}, method: "${method}", url: ${guardUrlExpr}, body: ${bodyExpr} }, async () => {
        try {
          const res = ${callExpr};
          return jsonResult(res.data);
        } catch (err) {
          ${catchApiError("          ")}
          throw err;
        }
      });`
    : `
      try {
        const res = ${callExpr};
        return jsonResult(${siteStatistics ? "siteStatistics(res.data, a.includeStatistics)" : "res.data"}, { pagination: res.pagination });
      } catch (err) {
        ${catchApiError("        ")}
        throw err;
      }`;

  return `// AUTO-GENERATED from ${docPath}. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { ${["jsonResult", "apiErrorResult", ...(removedUpstream ? ["removedUpstreamResult"] : []), ...(siteStatistics ? ["includeStatisticsParam", "siteStatistics"] : [])].join(", ")} } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";${isWrite ? `\nimport { ${surface === "network" ? "networkPath, withQuery" : "withQuery"} } from "../../client/unifiClient.js";` : ""}

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    ${JSON.stringify(toolName)},
    {
      title: ${JSON.stringify(toolName)},
      description: ${JSON.stringify(description)},
      inputSchema: z.object(${inputShape}),
      annotations: ${annotation},
    },
    async (a) => {${handlerBody}
    },
  );
}
`;
}
