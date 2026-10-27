/**
 * Protocol revisions over stdio against the built server (dist/index.js).
 *
 * A 2025-era client opens with `initialize` (2024-11-05 to 2025-11-25; some
 * clients send a `server/discover` probe first and fall back to `initialize`
 * when it is refused). A 2026-07-28 client opens with `server/discover` and
 * the per-request envelope. Both eras must be served by the same process with the
 * same 167 tools (tests/contract/tools-contract.json).
 *
 * Runs with `npm run test:stdio` after `npm run build` (not part of `npm test`,
 * because it needs dist/). Never reaches api.ui.com: dummy key, unreachable base.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ENTRY = `${ROOT}dist/index.js`;
const SNAPSHOT = JSON.parse(readFileSync(`${ROOT}tests/contract/tools-contract.json`, "utf8")) as {
  toolCount: number;
  tools: Array<{ name: string }>;
};
const ENV = {
  PATH: process.env.PATH ?? "",
  UNIFI_API_KEY: "stdio-test-dummy-key",
  UNIFI_API_BASE: "http://127.0.0.1:1",
  UNIFI_CONSOLE_ID: "stdio-console",
  UNIFI_NETWORK_SITE_ID: "stdio-net-site",
  UNIFI_SITE_MANAGER_SITE_ID: "stdio-sm-site",
  UNIFI_LOG_LEVEL: "error",
};

type Msg = { id?: number; result?: Record<string, unknown>; error?: unknown };
const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const c of cleanups.splice(0)) await c();
});

function startRaw(): {
  request: (id: number, method: string, params: Record<string, unknown>) => Promise<Msg>;
  notify: (method: string) => void;
} {
  const child: ChildProcessWithoutNullStreams = spawn(process.execPath, [ENTRY], {
    env: ENV,
    stdio: ["pipe", "pipe", "pipe"],
  });
  cleanups.push(() => {
    child.kill();
  });
  const waiting = new Map<number, (m: Msg) => void>();
  let buf = "";
  child.stdout.on("data", (d: Buffer) => {
    buf += d.toString("utf8");
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as Msg;
      if (typeof msg.id === "number") waiting.get(msg.id)?.(msg);
    }
  });
  return {
    request: (id, method, params) =>
      new Promise((resolve) => {
        waiting.set(id, resolve);
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      }),
    notify: (method) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method }) + "\n"),
  };
}

async function listAll(
  request: (id: number, method: string, params: Record<string, unknown>) => Promise<Msg>,
): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  let id = 100;
  do {
    const res = await request(id++, "tools/list", cursor ? { cursor } : {});
    expect(res.error).toBeUndefined();
    names.push(...(res.result!.tools as Array<{ name: string }>).map((t) => t.name));
    cursor = res.result!.nextCursor as string | undefined;
  } while (cursor);
  return names;
}

const expectedNames = SNAPSHOT.tools.map((t) => t.name).sort();

describe("stdio protocol revisions (dist/index.js)", () => {
  it.each(["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"])(
    "initialize with %s returns the same revision and all snapshot tools",
    async (version) => {
      const { request, notify } = startRaw();
      const init = await request(1, "initialize", {
        protocolVersion: version,
        capabilities: {},
        clientInfo: { name: "stdio-protocol-test", version: "0" },
      });
      expect(init.error).toBeUndefined();
      expect(init.result?.protocolVersion).toBe(version);
      notify("notifications/initialized");
      expect((await listAll(request)).sort()).toEqual(expectedNames);
    },
    20_000,
  );

  it("serves a client pinned to 2026-07-28 with all snapshot tools and an offline write preview", async () => {
    const client = new Client(
      { name: "stdio-protocol-test", version: "0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [ENTRY],
      env: ENV,
      stderr: "ignore",
    });
    await client.connect(transport);
    cleanups.push(() => client.close());
    const names: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : {});
      names.push(...page.tools.map((t) => t.name));
      cursor = page.nextCursor;
    } while (cursor);
    expect(names.sort()).toEqual(expectedNames);
    expect(names).toHaveLength(SNAPSHOT.toolCount);

    // Write without confirm: preview only, no request leaves the process.
    const res = await client.callTool({ name: "unifi_net_create_network", arguments: {} });
    expect(res.isError).toBeFalsy();
    const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
    expect(JSON.parse(text)).toHaveProperty("data.preview");
  }, 20_000);
});
