type DocSchema = Record<string, unknown>;

export interface SchemaOptions {
  /**
   * Request-body mode (N-37), compact: one `z.looseObject` (unknown keys are
   * kept and sent, never stripped) that lists the top-level properties with
   * their plain type only. The variants of a discriminator or a oneOf/anyOf are
   * merged into that one object, the tag as enum; nested schemas and vendor
   * descriptions stay on the vendor docs page that the tool description names.
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

/** Body mode: a string enum with more values than this is listed as plain z.string(). */
export const BODY_ENUM_CAP = 8;

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
  const ctx: Ctx = { refs, loose: opts.loose === true, stack: [] };
  return ctx.loose ? compactBody(schema, ctx) : toZod(schema, ctx);
}

function toZod(schema: DocSchema | undefined, ctx: Ctx): string {
  if (!schema || typeof schema !== "object") return "z.unknown()";
  const out = toZodInner(schema, ctx);
  return schema.nullable === true && out !== "z.unknown()" ? `${out}.nullable()` : out;
}

function resolveRef(ref: string, ctx: Ctx): string {
  const name = refName(ref);
  const target = ctx.refs[name];
  if (!target || ctx.stack.includes(name)) return "z.unknown()";
  return toZod(target, { ...ctx, stack: [...ctx.stack, name] });
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

function toZodInner(schema: DocSchema, ctx: Ctx): string {
  if (typeof schema.$ref === "string") return resolveRef(schema.$ref, ctx);

  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const arr = (schema.oneOf ?? schema.anyOf) as DocSchema[];
    const parts = arr.map((s) => toZod(s, ctx));
    return `z.union([${parts.join(",")}])`;
  }

  if (Array.isArray(schema.allOf)) {
    // Params: only inline parts, as 0.2.1 did.
    const merged: DocSchema = { type: "object", properties: {}, required: [] };
    for (const part of schema.allOf as DocSchema[]) {
      if (part.properties) Object.assign(merged.properties as object, part.properties);
      if (Array.isArray(part.required))
        (merged.required as string[]).push(...(part.required as string[]));
    }
    return toZod(merged, ctx);
  }

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
  if (t === "object") {
    return objectSource(schema, ctx);
  }

  return "z.unknown()";
}

function objectSource(schema: DocSchema, ctx: Ctx): string {
  const props = (schema.properties ?? {}) as Record<string, DocSchema>;
  const required = new Set((schema.required as string[]) ?? []);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    const base = ctx.loose ? shallowType(v, ctx, ctx.stack) : toZod(v, ctx);
    const safe = IDENT.test(k) ? k : JSON.stringify(k);
    // N-63: a required key without a usable schema stays optional (zod 3 behaviour).
    const optional = !required.has(k) || base.startsWith("z.unknown()");
    lines.push(`${safe}: ${base}${optional ? ".optional()" : ""}`);
  }
  const extra = schema.additionalProperties;
  if (lines.length === 0 && (extra === true || (ctx.loose && extra && typeof extra === "object"))) {
    const value = extra === true || ctx.loose ? "z.unknown()" : toZod(extra as DocSchema, ctx);
    return `z.record(z.string(), ${value})`;
  }
  if (ctx.loose) return `z.looseObject({${lines.join(",")}})`;
  const passthrough = extra === true ? ".passthrough()" : "";
  return `z.object({${lines.join(",")}})${passthrough}`;
}

interface FlatObject {
  properties: Record<string, DocSchema>;
  required: string[];
}

/**
 * Body mode: the object variants of a request body, each flattened (allOf and
 * `$ref` resolved, a discriminator tag set as `const`). Undefined when the body
 * is not an object or a union of objects.
 */
function bodyVariants(schema: DocSchema, ctx: Ctx, stack: string[]): FlatObject[] | undefined {
  if (typeof schema.$ref === "string") {
    const name = refName(schema.$ref);
    const target = ctx.refs[name];
    if (!target || stack.includes(name)) return undefined;
    return bodyVariants(target, ctx, [...stack, name]);
  }
  const disc = schema.discriminator as
    { propertyName?: string; mapping?: Record<string, string> } | undefined;
  if (disc?.propertyName && disc.mapping) {
    const out: FlatObject[] = [];
    for (const [tag, ref] of Object.entries(disc.mapping)) {
      const name = refName(ref);
      const target = ctx.refs[name];
      if (!target || stack.includes(name)) return undefined;
      // Only the variant on the path: its allOf names the base schema that holds
      // the discriminator, whose properties belong to every variant.
      const flat = mergeAllOf(target, ctx, [name]) as unknown as FlatObject;
      out.push({
        properties: { ...flat.properties, [disc.propertyName]: { const: tag } },
        required: flat.required,
      });
    }
    return out.length > 0 ? out : undefined;
  }
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const out: FlatObject[] = [];
    for (const part of (schema.oneOf ?? schema.anyOf) as DocSchema[]) {
      const v = bodyVariants(part, ctx, stack);
      if (!v) return undefined;
      out.push(...v);
    }
    return out.length > 0 ? out : undefined;
  }
  if (Array.isArray(schema.allOf) || schema.type === "object" || schema.properties) {
    if (schema.type === "object" && !schema.properties && !schema.allOf) {
      return [{ properties: {}, required: [] }];
    }
    return [mergeAllOf(schema, ctx, stack) as unknown as FlatObject];
  }
  return undefined;
}

/** Body mode: the variants merged into one compact `z.looseObject`. */
function compactBody(schema: DocSchema | undefined, ctx: Ctx): string {
  if (!schema || typeof schema !== "object") return "z.unknown()";
  const variants = bodyVariants(schema, ctx, ctx.stack);
  if (!variants) return shallowType(schema, ctx, ctx.stack);
  if (variants.length === 1 && Object.keys(variants[0]!.properties).length === 0) {
    const extra = schema.additionalProperties;
    if (extra === true || (extra && typeof extra === "object")) {
      return "z.record(z.string(), z.unknown())";
    }
  }
  const byKey = new Map<string, DocSchema[]>();
  for (const v of variants) {
    for (const [k, s] of Object.entries(v.properties)) byKey.set(k, [...(byKey.get(k) ?? []), s]);
  }
  const properties: Record<string, DocSchema> = {};
  for (const [k, list] of byKey) {
    const consts = list.map((s) => s.const);
    if (list.length > 1 && consts.every((c) => typeof c === "string")) {
      properties[k] = { type: "string", enum: consts };
    } else {
      properties[k] = list.length === 1 ? list[0]! : { oneOf: list };
    }
  }
  const required = [...byKey.keys()].filter((k) => variants.every((v) => v.required.includes(k)));
  return objectSource({ type: "object", properties, required }, ctx);
}

/**
 * Body mode, one property: its plain type only (string, number, boolean,
 * array, object, a literal tag or a short string enum), never its nested
 * schema. A union of mixed types, an unresolvable or a recursive `$ref` is
 * `z.unknown()`. Nested objects and arrays accept any content, so the typed
 * branch never drops nested keys.
 */
function shallowType(schema: DocSchema | undefined, ctx: Ctx, seen: string[]): string {
  if (!schema || typeof schema !== "object") return "z.unknown()";
  if (typeof schema.$ref === "string") {
    const name = refName(schema.$ref);
    const target = ctx.refs[name];
    if (!target || seen.includes(name)) return "z.unknown()";
    return shallowType(target, ctx, [...seen, name]);
  }
  let out: string;
  if ("const" in schema) {
    out = `z.literal(${JSON.stringify(schema.const)})`;
  } else if (
    Array.isArray(schema.enum) &&
    schema.enum.length > 0 &&
    schema.enum.every((v) => typeof v === "string")
  ) {
    const vals = schema.enum;
    out =
      vals.length <= BODY_ENUM_CAP
        ? `z.enum([${vals.map((v) => JSON.stringify(v)).join(",")}])`
        : "z.string()";
  } else if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const parts = ((schema.oneOf ?? schema.anyOf) as DocSchema[]).map((p) =>
      shallowType(p, ctx, seen),
    );
    const kinds = new Set(parts.map((p) => p.replace(/\.nullable\(\)$/, "")));
    out = kinds.size === 1 ? [...kinds][0]! : "z.unknown()";
  } else {
    const t = schema.type;
    if (t === "string") out = "z.string()";
    else if (t === "integer" || t === "number") out = "z.number()";
    else if (t === "boolean") out = "z.boolean()";
    else if (t === "array") out = "z.array(z.unknown())";
    else if (t === "object" || schema.properties || schema.allOf || schema.discriminator) {
      out = "z.looseObject({})";
    } else out = "z.unknown()";
  }
  return schema.nullable === true && out !== "z.unknown()" ? `${out}.nullable()` : out;
}
