import type { EndpointSpec } from "../client/rsc.js";
import { schemaToZodSource } from "./schemaFromDoc.js";

export interface EmitInput {
  toolName: string;
  surface: "siteManager" | "network";
  docPath: string;
  endpoint: EndpointSpec;
}

const READ_ONLY = `{ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }`;
const WRITE_ONCE = `{ readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }`;
const WRITE_IDEMP = `{ readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }`;

function annotationFor(method: EndpointSpec["method"]): string {
  if (method === "GET") return READ_ONLY;
  if (method === "POST") return WRITE_ONCE;
  return WRITE_IDEMP;
}

function buildInputShape(ep: EndpointSpec, isWrite: boolean): string {
  const parts: string[] = [];
  const params = ep.parameters ?? [];
  for (const p of params) {
    const base = schemaToZodSource(p.schema as Record<string, unknown> | undefined);
    const desc = p.description ? `.describe(${JSON.stringify(p.description)})` : "";
    const opt = p.required ? "" : ".optional()";
    const safe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p.name) ? p.name : JSON.stringify(p.name);
    parts.push(`${safe}: ${base}${desc}${opt}`);
  }
  if (ep.requestBody) {
    const inner = schemaToZodSource(ep.requestBody.schema as Record<string, unknown> | undefined);
    parts.push(`body: ${inner}`);
  }
  if (isWrite) parts.push(`...confirmShape`);
  return `{${parts.join(", ")}}`;
}

function pathTemplate(path: string): string {
  return path.replace(/\{([^}]+)\}/g, (_, n) => `\${encodeURIComponent(String(a.${n}))}`);
}

function queryPicker(ep: EndpointSpec): string {
  const queryParams = (ep.parameters ?? []).filter((p) => p.in === "query");
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
  const { toolName, surface, docPath, endpoint } = input;
  const method = endpoint.method;
  const isWrite = method !== "GET";
  const description = `${endpoint.summary ?? endpoint.description ?? toolName} — generated from developer.ui.com/${docPath}`.replace(/\s+/g, " ").trim();
  const inputShape = buildInputShape(endpoint, isWrite);
  const annotation = annotationFor(method);

  const path = endpoint.path;
  const pathExpr = `\`${pathTemplate(path)}\``;
  const queryExpr = queryPicker(endpoint);
  const bodyExpr = endpoint.requestBody ? "a.body" : "undefined";

  const callExpr = surface === "network"
    ? `await ctx.client.requestNetwork("${method}", await ctx.discovery.consoleId(), ${pathExpr}, { body: ${bodyExpr}, query: ${queryExpr} })`
    : `await ctx.client.request("${method}", ${pathExpr}, { body: ${bodyExpr}, query: ${queryExpr} })`;

  const handlerBody = isWrite
    ? `
      return runGuarded(ctx.cfg, a, { toolName: ${JSON.stringify(toolName)}, method: "${method}", url: ${pathExpr}, body: ${bodyExpr} }, async () => {
        try {
          const res = ${callExpr};
          return jsonResult(res.data);
        } catch (err) {
          if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
          throw err;
        }
      });`
    : `
      try {
        const res = ${callExpr};
        return jsonResult(res.data, { pagination: res.pagination });
      } catch (err) {
        if (err instanceof UnifiApiError) return errorResult(err.message, { statusCode: err.statusCode });
        throw err;
      }`;

  return `// AUTO-GENERATED from ${docPath}. Do not edit by hand.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../../server.js";
import { jsonResult, errorResult } from "../helpers.js";
import { runGuarded, confirmShape } from "../destructiveGuard.js";
import { UnifiApiError } from "../../client/errors.js";

export function register(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    ${JSON.stringify(toolName)},
    {
      title: ${JSON.stringify(toolName)},
      description: ${JSON.stringify(description)},
      inputSchema: ${inputShape},
      annotations: ${annotation},
    },
    async (a) => {${handlerBody}
    },
  );
}
`;
}
