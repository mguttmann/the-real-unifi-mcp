import { describe, expect, it } from "vitest";
import { emitToolFile } from "../../src/codegen/emit.js";
import type { EndpointSpec } from "../../src/codegen/openapi.js";

function emit(endpoint: Partial<EndpointSpec>, extra: Record<string, unknown> = {}): string {
  return emitToolFile({
    toolName: "unifi_gen_creatething",
    surface: "network",
    docPath: "network/v11/creatething",
    endpoint: { path: "/v1/sites/{siteId}/things", method: "POST", ...endpoint },
    refs: {},
    ...extra,
  });
}

const inputSchemaLine = (src: string) => src.split("\n").find((l) => l.includes("inputSchema:"));

describe("emitToolFile", () => {
  it("emits an untyped request body as optional z.unknown() (v0.1.2 contract, audit M-1)", () => {
    expect(inputSchemaLine(emit({ requestBody: { required: true } }))).toMatch(
      /body: z\.unknown\(\)\.describe\(".*The API requires a body\."\)\.optional\(\),/,
    );
  });

  it("emits a typed body as a union with z.unknown(), still optional (N-37)", () => {
    const line = inputSchemaLine(
      emit({ requestBody: { required: false, schema: { type: "object", properties: {} } } }),
    );
    expect(line).toContain("body: z.union([z.looseObject({}), z.unknown()]).describe(");
    expect(line).toMatch(/\)\.optional\(\), \.\.\.confirmShape\}\)/);
    expect(line).not.toContain("requires a body");
  });

  it("marks a tool removed upstream in the description and maps 404 to REMOVED_UPSTREAM", () => {
    const src = emit({ method: "GET" }, { removedUpstream: "v10.3.58" });
    expect(src).toMatch(/description: ".*Removed from the vendor docs after v10\.3\.58/);
    expect(src).toContain(
      'err.statusCode === 404) return removedUpstreamResult("unifi_gen_creatething", "v10.3.58");',
    );
  });

  it("does not mention removal for current tools", () => {
    expect(emit({ method: "GET" })).not.toContain("removedUpstreamResult");
  });
});
