import { describe, expect, it } from "vitest";
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
    expect(schemaToZodSource({ type: "array", items: { type: "string" } })).toBe("z.array(z.string())");
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
  it("falls back to z.unknown() for unparseable", () => {
    expect(schemaToZodSource({ type: "weird-type" } as unknown as Record<string, unknown>)).toBe("z.unknown()");
  });
});
