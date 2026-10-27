type DocSchema = Record<string, unknown>;

export interface SchemaOptions {
  /**
   * Request-body mode (N-37): objects become `z.looseObject` (unknown keys are
   * kept and sent, never stripped), property descriptions are emitted, and a
   * discriminator expands into a union of its mapped schemas.
   */
  loose?: boolean;
}

interface Ctx {
  refs: Record<string, DocSchema>;
  loose: boolean;
  /** Component names being expanded on the current path (cycle guard). */
  stack: string[];
}

const IDENT = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/** Vendor text as a JS string literal: whitespace collapsed, em and en dashes replaced. */
export function docText(s: string): string {
  return s
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function refName(ref: string): string {
  return ref.split("/").pop()!;
}

/**
 * Converts a vendor (OpenAPI) schema into zod source code.
 *
 * Without `refs` a `$ref` stays `z.unknown()`: path and query params keep the
 * schemas published in 0.2.1. Spec `default`s are never emitted, because a
 * default would change the tool contract.
 */
export function schemaToZodSource(
  schema: DocSchema | undefined,
  refs: Record<string, DocSchema> = {},
  opts: SchemaOptions = {},
): string {
  return toZod(schema, { refs, loose: opts.loose === true, stack: [] });
}

function toZod(schema: DocSchema | undefined, ctx: Ctx, skipDiscriminator = false): string {
  if (!schema || typeof schema !== "object") return "z.unknown()";
  const out = toZodInner(schema, ctx, skipDiscriminator);
  return schema.nullable === true && out !== "z.unknown()" ? `${out}.nullable()` : out;
}

function resolveRef(ref: string, ctx: Ctx, skipDiscriminator: boolean): string {
  const name = refName(ref);
  const target = ctx.refs[name];
  if (!target || ctx.stack.includes(name)) return "z.unknown()";
  return toZod(target, { ...ctx, stack: [...ctx.stack, name] }, skipDiscriminator);
}

/** Flattens allOf parts (resolving $refs) into one object schema. */
function mergeAllOf(schema: DocSchema, ctx: Ctx, seen: string[]): DocSchema {
  const merged: { properties: Record<string, DocSchema>; required: string[] } = {
    properties: {},
    required: [],
  };
  const add = (part: DocSchema, path: string[]) => {
    if (typeof part.$ref === "string") {
      const name = refName(part.$ref);
      const target = ctx.refs[name];
      if (!target || path.includes(name)) return;
      add(target, [...path, name]);
      return;
    }
    if (Array.isArray(part.allOf)) for (const p of part.allOf as DocSchema[]) add(p, path);
    if (part.properties) Object.assign(merged.properties, part.properties);
    if (Array.isArray(part.required)) merged.required.push(...(part.required as string[]));
  };
  add(schema, seen);
  return {
    type: "object",
    properties: merged.properties,
    required: [...new Set(merged.required)],
  };
}

function toZodInner(schema: DocSchema, ctx: Ctx, skipDiscriminator: boolean): string {
  if (typeof schema.$ref === "string") return resolveRef(schema.$ref, ctx, skipDiscriminator);

  // A discriminator (body mode): one union member per mapped schema, the tag as literal.
  const disc = schema.discriminator as
    { propertyName?: string; mapping?: Record<string, string> } | undefined;
  if (ctx.loose && !skipDiscriminator && disc?.propertyName && disc.mapping) {
    const members = Object.entries(disc.mapping).map(([tag, ref]) => {
      const name = refName(ref);
      const target = ctx.refs[name];
      if (!target || ctx.stack.includes(name)) return "z.unknown()";
      const flat = mergeAllOf(target, ctx, [...ctx.stack, name]);
      const props = { ...(flat.properties as Record<string, DocSchema>) };
      props[disc.propertyName!] = { const: tag };
      return objectSource({ ...flat, properties: props }, { ...ctx, stack: [...ctx.stack, name] });
    });
    if (members.length === 1) return members[0]!;
    if (members.length > 1) return `z.union([${members.join(",")}])`;
  }

  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const arr = (schema.oneOf ?? schema.anyOf) as DocSchema[];
    const parts = arr.map((s) => toZod(s, ctx));
    return `z.union([${parts.join(",")}])`;
  }

  if (Array.isArray(schema.allOf)) {
    if (!ctx.loose) {
      // Params: only inline parts, as 0.2.1 did.
      const merged: DocSchema = { type: "object", properties: {}, required: [] };
      for (const part of schema.allOf as DocSchema[]) {
        if (part.properties) Object.assign(merged.properties as object, part.properties);
        if (Array.isArray(part.required))
          (merged.required as string[]).push(...(part.required as string[]));
      }
      return toZod(merged, ctx);
    }
    return objectSource(mergeAllOf(schema, ctx, ctx.stack), ctx);
  }

  if (ctx.loose && "const" in schema) return `z.literal(${JSON.stringify(schema.const)})`;

  const t = schema.type;
  if (typeof schema.enum !== "undefined" && Array.isArray(schema.enum)) {
    const vals = (schema.enum as unknown[]).filter((v): v is string => typeof v === "string");
    if (vals.length) return `z.enum([${vals.map((v) => JSON.stringify(v)).join(",")}])`;
  }

  if (t === "string") {
    let out = "z.string()";
    if (typeof schema.minLength === "number") out += `.min(${schema.minLength})`;
    if (typeof schema.maxLength === "number") out += `.max(${schema.maxLength})`;
    if (schema.format === "uuid") out += ".guid()";
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
    return `z.array(${toZod(items, ctx)})`;
  }
  if (t === "object" || (ctx.loose && t === undefined && schema.properties)) {
    return objectSource(schema, ctx);
  }

  return "z.unknown()";
}

function objectSource(schema: DocSchema, ctx: Ctx): string {
  const props = (schema.properties ?? {}) as Record<string, DocSchema>;
  const required = new Set((schema.required as string[]) ?? []);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    let base = toZod(v, ctx);
    if (ctx.loose && typeof v?.description === "string" && v.description.trim()) {
      base += `.describe(${JSON.stringify(docText(v.description))})`;
    }
    const safe = IDENT.test(k) ? k : JSON.stringify(k);
    // N-63: a required key without a usable schema stays optional (zod 3 behaviour).
    const optional = !required.has(k) || base.startsWith("z.unknown()");
    lines.push(`${safe}: ${base}${optional ? ".optional()" : ""}`);
  }
  const extra = schema.additionalProperties;
  if (lines.length === 0 && (extra === true || (ctx.loose && extra && typeof extra === "object"))) {
    const value = extra === true ? "z.unknown()" : toZod(extra as DocSchema, ctx);
    return `z.record(z.string(), ${value})`;
  }
  if (ctx.loose) return `z.looseObject({${lines.join(",")}})`;
  const passthrough = extra === true ? ".passthrough()" : "";
  return `z.object({${lines.join(",")}})${passthrough}`;
}
