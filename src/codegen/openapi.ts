/**
 * Reading the vendor OpenAPI documents (developer.ui.com/<surface>/<version>/openapi.json)
 * for the code generator (N-37, N-44).
 */

export type DocSchema = Record<string, unknown>;

export interface DocParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  schema?: unknown;
  description?: string;
}

export interface DocRequestBody {
  required?: boolean;
  /** `content["application/json"].schema` of the operation (N-37). */
  schema?: unknown;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointSpec {
  path: string;
  method: HttpMethod;
  parameters?: DocParameter[];
  requestBody?: DocRequestBody;
  summary?: string;
  description?: string;
  operationId?: string;
}

export interface OpenApiDoc {
  paths: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, DocSchema>; parameters?: Record<string, DocParameter> };
}

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function resolveParam(doc: OpenApiDoc, p: unknown): DocParameter | undefined {
  if (!p || typeof p !== "object") return undefined;
  const ref = (p as { $ref?: unknown }).$ref;
  if (typeof ref === "string") return doc.components?.parameters?.[ref.split("/").pop()!];
  return p as DocParameter;
}

/** Every operation of the document, path-level parameters merged into each. */
export function listOperations(doc: OpenApiDoc): EndpointSpec[] {
  const out: EndpointSpec[] = [];
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    const shared = Array.isArray(item.parameters) ? (item.parameters as unknown[]) : [];
    for (const method of METHODS) {
      const op = item[method.toLowerCase()] as Record<string, unknown> | undefined;
      if (!op || typeof op !== "object") continue;
      const own = Array.isArray(op.parameters) ? (op.parameters as unknown[]) : [];
      const byKey = new Map<string, DocParameter>();
      for (const raw of [...shared, ...own]) {
        const p = resolveParam(doc, raw);
        if (p) byKey.set(`${p.in}:${p.name}`, p);
      }
      const rb = op.requestBody as
        { required?: boolean; content?: Record<string, { schema?: unknown }> } | undefined;
      const ep: EndpointSpec = { path, method };
      if (byKey.size > 0) ep.parameters = [...byKey.values()];
      if (rb) {
        ep.requestBody = { required: rb.required === true };
        const schema = rb.content?.["application/json"]?.schema;
        if (schema !== undefined) ep.requestBody.schema = schema;
      }
      if (typeof op.summary === "string") ep.summary = op.summary;
      if (typeof op.description === "string") ep.description = op.description;
      if (typeof op.operationId === "string") ep.operationId = op.operationId;
      out.push(ep);
    }
  }
  return out;
}

/** The operation whose operationId, lowercased, equals `slug`. */
export function findOperation(doc: OpenApiDoc, slug: string): EndpointSpec | undefined {
  return listOperations(doc).find((op) => op.operationId?.toLowerCase() === slug);
}
