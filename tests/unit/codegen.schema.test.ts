import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BODY_ENUM_CAP, schemaToZodSource } from "../../src/codegen/schemaFromDoc.js";

/** Evaluates emitted zod source, as the generated tool files do. */
function compile(source: string): z.ZodType {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- evaluates emitted source on purpose
  return new Function("z", `return ${source}`)(z) as z.ZodType;
}

describe("schemaToZodSource", () => {
  it("emits z.string() for type string", () => {
    expect(schemaToZodSource({ type: "string" })).toBe("z.string()");
  });
  it("emits z.number() with optional min/max", () => {
    expect(schemaToZodSource({ type: "integer", minimum: 0, maximum: 100 })).toBe(
      "z.number().int().min(0).max(100)",
    );
  });
  it("emits z.enum for enum strings", () => {
    expect(schemaToZodSource({ type: "string", enum: ["a", "b"] })).toBe('z.enum(["a","b"])');
  });
  it("emits z.array(inner)", () => {
    expect(schemaToZodSource({ type: "array", items: { type: "string" } })).toBe(
      "z.array(z.string())",
    );
  });
  it("emits z.object for type object with properties", () => {
    const out = schemaToZodSource({
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" }, age: { type: "integer" } },
    });
    expect(out).toContain("z.object({");
    expect(out).toContain("name: z.string()");
    expect(out).toContain("age: z.number().int().optional()");
  });
  it("emits z.union for oneOf", () => {
    expect(schemaToZodSource({ oneOf: [{ type: "string" }, { type: "number" }] })).toBe(
      "z.union([z.string(),z.number()])",
    );
  });
  it("format uuid accepts any 8-4-4-4-12 hex id, as zod 3 .uuid() did", () => {
    // zod 4 .uuid() also checks the RFC version/variant digits; ids are opaque here.
    const schema = compile(schemaToZodSource({ type: "string", format: "uuid" }));
    expect(schema.safeParse("5f3c2a1b-0000-0000-0000-000000000001").success).toBe(true);
    expect(schema.safeParse("497f6eca-6276-4993-bfeb-53cbbbba6f08").success).toBe(true);
    expect(schema.safeParse("not-a-uuid").success).toBe(false);
  });
  it("emits a record with an explicit key schema for free-form objects", () => {
    const schema = compile(schemaToZodSource({ type: "object", additionalProperties: true }));
    expect(schema.safeParse({ a: 1, b: "x" }).success).toBe(true);
    expect(schema.safeParse("x").success).toBe(false);
  });
  it("falls back to z.unknown() for unparseable", () => {
    expect(schemaToZodSource({ type: "weird-type" })).toBe("z.unknown()");
  });
  it("keeps a $ref without component schemas as z.unknown() (param schemas of 0.2.1)", () => {
    expect(schemaToZodSource({ $ref: "#/components/schemas/FilterExpression" })).toBe(
      "z.unknown()",
    );
  });
  it("does not emit spec defaults", () => {
    expect(schemaToZodSource({ type: "integer", default: 25, minimum: 0 })).toBe(
      "z.number().int().min(0)",
    );
  });
});

describe("schemaToZodSource for typed request bodies (N-37, N-63)", () => {
  const refs = {
    Zone: {
      type: "object",
      required: ["name", "networkIds"],
      properties: {
        name: { type: "string", description: "Name of a zone" },
        networkIds: { type: "array", items: { type: "string", format: "uuid" } },
      },
    },
    Rule: {
      type: "object",
      required: ["type", "name"],
      discriminator: {
        propertyName: "type",
        mapping: { IPV4: "#/components/schemas/IpRule", MAC: "#/components/schemas/MacRule" },
      },
      properties: { type: { type: "string" }, name: { type: "string" } },
    },
    IpRule: {
      allOf: [
        { $ref: "#/components/schemas/Rule" },
        { type: "object", properties: { protocol: { type: "string", enum: ["TCP", "UDP"] } } },
      ],
    },
    MacRule: {
      allOf: [
        { $ref: "#/components/schemas/Rule" },
        { type: "object", properties: { mac: { type: "string" } } },
      ],
    },
    Node: {
      type: "object",
      properties: { name: { type: "string" }, child: { $ref: "#/components/schemas/Node" } },
    },
    Loose: {
      type: "object",
      required: ["anything"],
      properties: { anything: { description: "no type given" } },
    },
  };
  const typed = (name: string) =>
    compile(schemaToZodSource({ $ref: `#/components/schemas/${name}` }, refs, { loose: true }));

  it("resolves $ref against the component schemas", () => {
    const zone = typed("Zone");
    expect(zone.safeParse({ name: "z", networkIds: [] }).success).toBe(true);
    expect(zone.safeParse({ networkIds: [] }).success).toBe(false);
  });

  it("keeps unknown keys instead of stripping them (loose objects)", () => {
    const input = { name: "z", networkIds: [], extra: { deep: [1, 2] } };
    expect(typed("Zone").parse(input)).toEqual(input);
  });

  it("lists top-level properties with their plain type only (0.3.0 review: tools/list size)", () => {
    const src = schemaToZodSource(
      {
        type: "object",
        properties: {
          a: { type: "string", description: "x \u2014 y", format: "uuid", minLength: 1 },
          n: { type: "integer", minimum: 0 },
          deep: { type: "object", properties: { inner: { type: "string", description: "d" } } },
          list: { type: "array", items: { $ref: "#/components/schemas/Zone" } },
        },
      },
      refs,
      { loose: true },
    );
    expect(src).toBe(
      "z.looseObject({a: z.string().optional(),n: z.number().optional(),deep: z.looseObject({}).optional(),list: z.array(z.unknown()).optional()})",
    );
    // Nested content is not checked, so nothing nested is dropped or rejected.
    const input = { deep: { inner: 1, more: [1] }, list: [{ any: true }] };
    expect(compile(src).parse(input)).toEqual(input);
  });

  it("lists a short string enum, a long one as plain string", () => {
    expect(BODY_ENUM_CAP).toBe(8); // named in CHANGELOG.md 0.3.0
    const short = Array.from({ length: BODY_ENUM_CAP }, (_, i) => `V${i}`);
    const long = [...short, "MORE"];
    const src = schemaToZodSource(
      {
        type: "object",
        properties: { s: { type: "string", enum: short }, l: { type: "string", enum: long } },
      },
      {},
      { loose: true },
    );
    expect(src).toContain(`s: z.enum([${short.map((v) => JSON.stringify(v)).join(",")}])`);
    expect(src).toContain("l: z.string().optional()");
  });

  it("keeps the properties of the base schema that holds the discriminator", () => {
    const src = schemaToZodSource({ $ref: "#/components/schemas/Rule" }, refs, { loose: true });
    expect(src).toBe(
      'z.looseObject({type: z.enum(["IPV4","MAC"]),name: z.string(),protocol: z.enum(["TCP","UDP"]).optional(),mac: z.string().optional()})',
    );
  });

  it("merges the mapped schemas of a discriminator into one object, the tag as enum", () => {
    const rule = typed("Rule");
    expect(rule.safeParse({ type: "IPV4", name: "r", protocol: "TCP" }).success).toBe(true);
    expect(rule.safeParse({ type: "MAC", name: "r", mac: "aa" }).success).toBe(true);
    expect(rule.safeParse({ type: "OTHER", name: "r" }).success).toBe(false);
    expect(rule.safeParse({ type: "IPV4", name: "r", protocol: "ICMP" }).success).toBe(false);
  });

  it("stops at a recursive $ref with z.unknown()", () => {
    const node = typed("Node");
    expect(node.safeParse({ name: "a", child: { name: 1 } }).success).toBe(true);
  });

  it("makes a required property with no type optional (N-63)", () => {
    expect(typed("Loose").safeParse({}).success).toBe(true);
  });

  it("honours nullable", () => {
    const s = compile(schemaToZodSource({ type: "string", nullable: true }, {}, { loose: true }));
    expect(s.safeParse(null).success).toBe(true);
  });
});
