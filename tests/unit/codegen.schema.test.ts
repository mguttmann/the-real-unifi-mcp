import { describe, expect, it } from "vitest";
import { z } from "zod";
import { schemaToZodSource } from "../../src/codegen/schemaFromDoc.js";

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
    const schema = new Function(
      "z",
      `return ${schemaToZodSource({ type: "string", format: "uuid" })}`,
    )(z) as z.ZodType;
    expect(schema.safeParse("5f3c2a1b-0000-0000-0000-000000000001").success).toBe(true);
    expect(schema.safeParse("497f6eca-6276-4993-bfeb-53cbbbba6f08").success).toBe(true);
    expect(schema.safeParse("not-a-uuid").success).toBe(false);
  });
  it("emits a record with an explicit key schema for free-form objects", () => {
    const schema = new Function(
      "z",
      `return ${schemaToZodSource({ type: "object", additionalProperties: true })}`,
    )(z) as z.ZodType;
    expect(schema.safeParse({ a: 1, b: "x" }).success).toBe(true);
    expect(schema.safeParse("x").success).toBe(false);
  });
  it("falls back to z.unknown() for unparseable", () => {
    expect(schemaToZodSource({ type: "weird-type" } as unknown as Record<string, unknown>)).toBe(
      "z.unknown()",
    );
  });
});
