import { describe, expect, it } from "vitest";
import { emitToolFile } from "../../src/codegen/emit.js";
import type { EndpointSpec } from "../../src/client/rsc.js";

function inputSchemaLine(requestBody: unknown): string | undefined {
  return emitToolFile({
    toolName: "unifi_gen_creatething",
    surface: "network",
    docPath: "network/v10/creatething",
    endpoint: { path: "/v1/sites/{siteId}/things", method: "POST", requestBody } as EndpointSpec,
  })
    .split("\n")
    .find((l) => l.includes("inputSchema:"));
}

describe("emitToolFile", () => {
  it("emits the request body as optional (v0.1.2 contract, audit M-1)", () => {
    // Shape of the vendor docs today: schema nested under content (see N-37).
    expect(inputSchemaLine({ content: {}, required: true })).toContain(
      "body: z.unknown().optional(),",
    );
    expect(inputSchemaLine({ schema: { type: "object" } })).toContain(
      "body: z.object({}).optional(),",
    );
  });
});
