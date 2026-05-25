type DocSchema = Record<string, unknown>;

export function schemaToZodSource(schema: DocSchema | undefined, refs: Record<string, DocSchema> = {}): string {
  if (!schema || typeof schema !== "object") return "z.unknown()";

  if (typeof schema.$ref === "string") {
    const ref = schema.$ref;
    const name = ref.split("/").pop()!;
    if (refs[name]) return schemaToZodSource(refs[name], refs);
    return "z.unknown()";
  }

  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const arr = (schema.oneOf ?? schema.anyOf) as DocSchema[];
    const parts = arr.map((s) => schemaToZodSource(s, refs));
    return `z.union([${parts.join(",")}])`;
  }

  if (Array.isArray(schema.allOf)) {
    const merged: DocSchema = { type: "object", properties: {}, required: [] };
    for (const part of schema.allOf as DocSchema[]) {
      if (part.properties) Object.assign(merged.properties as object, part.properties as object);
      if (Array.isArray(part.required)) (merged.required as string[]).push(...(part.required as string[]));
    }
    return schemaToZodSource(merged, refs);
  }

  const t = schema.type;
  if (typeof schema.enum !== "undefined" && Array.isArray(schema.enum)) {
    const vals = (schema.enum as unknown[]).filter((v) => typeof v === "string") as string[];
    if (vals.length) return `z.enum([${vals.map((v) => JSON.stringify(v)).join(",")}])`;
  }

  if (t === "string") {
    let out = "z.string()";
    if (typeof schema.minLength === "number") out += `.min(${schema.minLength})`;
    if (typeof schema.maxLength === "number") out += `.max(${schema.maxLength})`;
    if (schema.format === "uuid") out += ".uuid()";
    if (schema.format === "uri") out += ".url()";
    return out;
  }
  if (t === "integer" || t === "number") {
    let out = "z.number()";
    if (t === "integer") out += ".int()";
    if (typeof schema.minimum === "number") out += `.min(${schema.minimum})`;
    if (typeof schema.maximum === "number") out += `.max(${schema.maximum})`;
    return out;
  }
  if (t === "boolean") return "z.boolean()";
  if (t === "array") {
    const items = schema.items as DocSchema | undefined;
    return `z.array(${schemaToZodSource(items, refs)})`;
  }
  if (t === "object") {
    const props = (schema.properties ?? {}) as Record<string, DocSchema>;
    const required = new Set((schema.required as string[]) ?? []);
    const lines: string[] = [];
    for (const [k, v] of Object.entries(props)) {
      const base = schemaToZodSource(v, refs);
      const safe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      lines.push(`${safe}: ${base}${required.has(k) ? "" : ".optional()"}`);
    }
    if (schema.additionalProperties === true && lines.length === 0) {
      return "z.record(z.unknown())";
    }
    const passthrough = schema.additionalProperties === true ? ".passthrough()" : "";
    return `z.object({${lines.join(",")}})${passthrough}`;
  }

  return "z.unknown()";
}
