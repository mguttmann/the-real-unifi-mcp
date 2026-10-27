/**
 * Generated tools must equal what the codegen template emits (audit M-1, N-44).
 *
 * Live codegen needs developer.ui.com, so this test stays offline: the three
 * vendor fixtures are re-emitted and compared byte for byte, and every other
 * generated file is checked for the template's body declaration.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractEndpointJson } from "../../src/client/rsc.js";
import { CATALOG } from "../../src/codegen/catalog.js";
import { emitToolFile } from "../../src/codegen/emit.js";

const GEN_DIR = fileURLToPath(new URL("../../src/tools/generated/", import.meta.url));
const FIXTURE_DIR = fileURLToPath(new URL("../fixtures/rsc/", import.meta.url));

function generated(name: string): string {
  return readFileSync(`${GEN_DIR}${name}.ts`, "utf8");
}

describe("generated tools match the codegen template", () => {
  it.each(["createfirewallpolicy", "deletefirewallpolicy", "getinfo"])(
    "re-emitting fixture %s reproduces the committed file",
    (page) => {
      const entry = CATALOG.find((e) => e.docPath.endsWith(`/${page}`));
      expect(entry).toBeDefined();
      const endpoint = extractEndpointJson(readFileSync(`${FIXTURE_DIR}${page}.txt`, "utf8"));
      expect(endpoint).not.toBeNull();
      const emitted = emitToolFile({
        toolName: entry!.toolName,
        surface: entry!.surface,
        docPath: entry!.docPath,
        endpoint: endpoint!,
      });
      expect(emitted).toBe(generated(entry!.toolName));
    },
  );

  it("declares body as optional in every generated tool that sends one", () => {
    const files = readdirSync(GEN_DIR).filter((f) => f.startsWith("unifi_gen_"));
    const withBody = files.filter((f) => generated(f.slice(0, -3)).includes("body: a.body"));
    const notOptional = withBody.filter(
      (f) =>
        !/inputSchema: z\.object\(\{.*\bbody: z\.unknown\(\)\.optional\(\), \.\.\.confirmShape\}\)/.test(
          generated(f.slice(0, -3)),
        ),
    );
    expect(withBody).toHaveLength(23);
    expect(notOptional).toEqual([]);
  });
});
