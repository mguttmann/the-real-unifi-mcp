/**
 * Tool contract (audit N-8): MCP gateways and clients that call this server
 * rely on tool names, required params, defaults and annotations.
 *
 * Starts the real server in-process over InMemoryTransport, calls tools/list and
 * compares every tool against tests/contract/tools-contract.json.
 *
 * Hard contract (test fails): tool names, tool count, required params, property
 * names, JSON-schema defaults, annotations. A deliberate change is made by
 * editing the snapshot by hand AND listing it in CHANGELOG.md under
 * "Behaviour changes for callers".
 *
 * Noise (reported on stderr, never fails): title/description text and the
 * remaining inputSchema bytes (types, patterns, $schema, key order). To accept
 * reported noise, run
 *   UPDATE_CONTRACT_NOISE=1 npx vitest run tests/unit/contract.test.ts
 * which rewrites only the two hash fields and leaves the hard fields untouched.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Tool } from "@modelcontextprotocol/server";
import {
  connectInProcess,
  listLiveTools,
  toContractTool,
  type ContractSnapshot,
  type ContractTool,
} from "../contract/liveTools.js";

const SNAPSHOT_PATH = fileURLToPath(new URL("../contract/tools-contract.json", import.meta.url));
const README_PATH = fileURLToPath(new URL("../../README.md", import.meta.url));
const PACKAGE_PATH = fileURLToPath(new URL("../../package.json", import.meta.url));
const MANIFEST_PATH = fileURLToPath(new URL("../../mcpb/manifest.json", import.meta.url));

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as ContractSnapshot;
let live: { serverVersion: string | undefined; tools: Tool[] };
let liveContract: Map<string, ContractTool>;

beforeAll(async () => {
  live = await listLiveTools();
  liveContract = new Map(live.tools.map((t) => [t.name, toContractTool(t)]));
});

const HARD_FIELDS = ["required", "properties", "defaults", "annotations"] as const;
const NOISE_FIELDS = ["textSha256", "inputSchemaSha256"] as const;

describe("tool contract (tests/contract/tools-contract.json)", () => {
  it("lists exactly the snapshot tool names", () => {
    const expected = snapshot.tools.map((t) => t.name).sort();
    const actual = [...liveContract.keys()].sort();
    expect({
      missing: expected.filter((n) => !liveContract.has(n)),
      added: actual.filter((n) => !expected.includes(n)),
    }).toEqual({ missing: [], added: [] });
    expect(actual.length).toBe(snapshot.toolCount);
    expect(live.tools.length).toBe(snapshot.toolCount);
  });

  it("keeps required params, property names, defaults and annotations of every tool", () => {
    const diffs: string[] = [];
    for (const want of snapshot.tools) {
      const got = liveContract.get(want.name);
      if (!got) continue; // reported by the names test
      for (const f of HARD_FIELDS) {
        if (JSON.stringify(got[f]) !== JSON.stringify(want[f])) {
          diffs.push(
            `${want.name}.${f}: snapshot ${JSON.stringify(want[f])} live ${JSON.stringify(got[f])}`,
          );
        }
      }
    }
    expect(diffs).toEqual([]);
  });

  it("reports description and schema-byte noise without failing", () => {
    const noise: string[] = [];
    for (const want of snapshot.tools) {
      const got = liveContract.get(want.name);
      if (!got) continue;
      for (const f of NOISE_FIELDS) if (got[f] !== want[f]) noise.push(`${want.name}.${f}`);
    }
    if (noise.length > 0) {
      if (process.env.UPDATE_CONTRACT_NOISE === "1") {
        const updated: ContractSnapshot = {
          ...snapshot,
          tools: snapshot.tools.map((t) => {
            const got = liveContract.get(t.name);
            return got
              ? { ...t, textSha256: got.textSha256, inputSchemaSha256: got.inputSchemaSha256 }
              : t;
          }),
        };
        writeFileSync(SNAPSHOT_PATH, JSON.stringify(updated, null, 2) + "\n");
        process.stderr.write(`[contract] rewrote noise hashes for ${noise.length} field(s)\n`);
      } else {
        process.stderr.write(
          `[contract] ${noise.length} non-contract schema/text change(s) (list in CHANGELOG, then accept with UPDATE_CONTRACT_NOISE=1):\n  ${noise.join("\n  ")}\n`,
        );
      }
    }
    expect(Array.isArray(noise)).toBe(true);
  });

  it("README tool counts match tools/list", () => {
    const readme = readFileSync(README_PATH, "utf8");
    const total = live.tools.length;
    const generated = live.tools.filter((t) => t.name.startsWith("unifi_gen_")).length;
    const totals = [...readme.matchAll(/\b(\d+)\*{0,2} tools\b/g)].map((m) => Number(m[1]));
    const gens = [
      ...readme.matchAll(/\b(\d+) auto-generated tools/g),
      ...readme.matchAll(/Auto-generated tools \((\d+)\)/g),
    ].map((m) => Number(m[1]));
    expect(totals.length).toBeGreaterThan(0);
    expect(gens.length).toBeGreaterThan(0);
    expect(new Set(totals)).toEqual(new Set([total]));
    expect(new Set(gens)).toEqual(new Set([generated]));
  });
});

describe("body stays optional at call time (audit M-1)", () => {
  // zod 4 made body required on 42 tools (-32602 when omitted); v0.1.2 accepted
  // a missing body. With UNIFI_CONFIRM_WRITES on, a write without confirm only
  // returns a preview, so these calls stay offline.
  it.each([
    ["unifi_net_create_network", {}],
    ["unifi_net_update_network", { id: "x" }],
    ["unifi_gen_createnetwork", {}],
  ])("%s accepts a call without body", async (name, args) => {
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({ name, arguments: args });
      expect(res.isError).toBeFalsy();
      const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      expect(JSON.parse(text)).toHaveProperty("data.preview");
    } finally {
      await close();
    }
  });
});

describe("server identity", () => {
  // Audit N-13: serverInfo, package.json and the MCPB manifest must not drift.
  it("serverInfo version equals package.json version (N-13)", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8")) as { version: string };
    expect(live.serverVersion).toBe(pkg.version);
  });

  it("MCPB manifest version equals package.json version (N-13)", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8")) as { version: string };
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as { version: string };
    expect(manifest.version).toBe(pkg.version);
  });
});
