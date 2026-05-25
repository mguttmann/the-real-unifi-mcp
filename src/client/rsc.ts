export interface DocParameter {
  name: string;
  in: "query" | "path" | "header";
  required?: boolean;
  schema?: unknown;
  description?: string;
}

export interface DocRequestBody {
  required?: boolean;
  schema?: unknown;
  description?: string;
}

export interface DocResponse {
  description?: string;
  schema?: unknown;
}

export interface EndpointSpec {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  parameters?: DocParameter[];
  requestBody?: DocRequestBody;
  responses?: Record<string, DocResponse>;
  summary?: string;
  description?: string;
  operationId?: string;
}

export function decodeUnicodeEscapes(s: string): string {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Find a balanced JSON object following `"endpoint":` in the RSC stream.
 * The RSC payload is JS-encoded text with literal `\u` escapes; decode first,
 * then walk braces honoring JSON string state.
 */
export function extractEndpointJson(rawText: string): EndpointSpec | null {
  const text = decodeUnicodeEscapes(rawText);
  const marker = '"endpoint":';
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf(marker, searchFrom);
    if (idx === -1) return null;
    const start = text.indexOf("{", idx + marker.length);
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    let foundEnd = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\" && inString) { escape = true; continue; }
      if (ch === '"') inString = !inString;
      else if (!inString && ch === "{") depth++;
      else if (!inString && ch === "}") {
        depth--;
        if (depth === 0) { foundEnd = i; break; }
      }
    }
    if (foundEnd === -1) {
      searchFrom = start + 1;
      continue;
    }
    const slice = text.slice(start, foundEnd + 1);
    try {
      return JSON.parse(slice) as EndpointSpec;
    } catch {
      searchFrom = foundEnd + 1;
    }
  }
}

export interface FetchEndpointOptions {
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
}

export async function fetchEndpointSpec(
  docPath: string,
  opts: FetchEndpointOptions = {},
): Promise<EndpointSpec | null> {
  const base = opts.baseUrl ?? "https://developer.ui.com";
  const f = opts.fetch ?? globalThis.fetch;
  const url = `${base}/${docPath.replace(/^\/+/, "")}`;
  const res = await f(url, { headers: { RSC: "1", Accept: "text/x-component" } });
  if (!res.ok) throw new Error(`Doc fetch failed for ${url}: HTTP ${res.status}`);
  const text = await res.text();
  return extractEndpointJson(text);
}
