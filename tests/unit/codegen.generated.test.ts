/**
 * Drift check (N-44): `src/tools/generated/` must equal what the code
 * generator emits from the committed vendor OpenAPI documents
 * (tests/fixtures/openapi/), byte for byte and file for file. This is what
 * `npm run codegen -- --offline` writes.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOG } from "../../src/codegen/catalog.js";
import { generateFiles, loadFixtureSpecs } from "../../src/codegen/generate.js";

const GEN_DIR = fileURLToPath(new URL("../../src/tools/generated/", import.meta.url));
const FIXTURE_DIR = fileURLToPath(new URL("../fixtures/openapi/", import.meta.url));

describe("generated tools equal the codegen output of the committed vendor specs", () => {
  const { files, failures } = generateFiles(loadFixtureSpecs(FIXTURE_DIR));

  it("generates every catalog entry without failure", () => {
    expect(failures).toEqual([]);
    expect(files.size).toBe(CATALOG.length + 1);
  });

  it("has exactly the generated file set", () => {
    expect(readdirSync(GEN_DIR).sort()).toEqual([...files.keys()].sort());
  });

  it.each(CATALOG.map((e) => `${e.toolName}.ts`).concat("index.ts"))(
    "%s is byte-identical",
    (file) => {
      expect(readFileSync(`${GEN_DIR}${file}`, "utf8")).toBe(files.get(file));
    },
  );

  it("declares body as optional in every generated tool that sends one", () => {
    const withBody = [...files.entries()].filter(([, src]) => src.includes("body: a.body"));
    expect(withBody).toHaveLength(23);
    const notOptional = withBody
      .filter(
        ([, src]) =>
          !/inputSchema: z\.object\(\{.*\bbody: .*\.optional\(\), \.\.\.confirmShape\}\)/s.test(
            src,
          ),
      )
      .map(([f]) => f);
    expect(notOptional).toEqual([]);
  });
});
