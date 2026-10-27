/**
 * `.env` loading over stdio against the built server (dist/index.js).
 *
 * The server reads a `.env` from its working directory and fills unset
 * variables (BACKLOG N-58, behaviour kept). stdout is the JSON-RPC channel, so
 * dotenv must never write to it, not even when its own environment switches
 * (`DOTENV_CONFIG_QUIET=false`, `DOTENV_CONFIG_DEBUG=true` and the dotenv 18
 * aliases `DOTENV_QUIET`, `DOTENV_DEBUG`) or a `.env` entry ask for logging.
 *
 * Runs with `npm run test:stdio` after `npm run build`. Never reaches
 * api.ui.com: dummy key, unreachable base.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ENTRY = `${ROOT}dist/index.js`;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

type Run = { stdout: string; stderr: string; code: number | null };

/**
 * Starts the server in `cwd`, sends initialize and tools/list, waits for the
 * tools/list answer, closes stdin and returns everything the process wrote.
 */
function runSession(cwd: string, env: NodeJS.ProcessEnv): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [ENTRY], { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`timeout; stdout=${stdout} stderr=${stderr}`));
    }, 15_000);
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
      // The tools/list answer (id 2) ends the session.
      if (/"id":2[,}]/.test(stdout) && stdout.endsWith("\n")) child.stdin.end();
    });
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    const send = (m: object) => child.stdin.write(JSON.stringify(m) + "\n");
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "stdio-dotenv-test", version: "0" },
      },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  });
}

describe("dotenv over stdio (dist/index.js)", () => {
  it("loads .env from the working directory and keeps stdout pure JSON-RPC", async () => {
    const dir = mkdtempSync(join(tmpdir(), "unifi-mcp-dotenv-"));
    dirs.push(dir);
    // The key exists only in .env: the server starts only if .env was read.
    // UNIFI_LOG_LEVEL is set in both places, which makes a debugging dotenv
    // log "already defined"; the DOTENV_* entries try to turn logging on.
    writeFileSync(
      join(dir, ".env"),
      [
        "UNIFI_API_KEY=dotenv-test-dummy-key",
        "UNIFI_LOG_LEVEL=debug",
        "DOTENV_CONFIG_QUIET=false",
        "DOTENV_QUIET=false",
        "",
      ].join("\n"),
    );
    const run = await runSession(dir, {
      PATH: process.env.PATH ?? "",
      UNIFI_API_BASE: "http://127.0.0.1:1",
      UNIFI_CONSOLE_ID: "stdio-console",
      UNIFI_NETWORK_SITE_ID: "stdio-net-site",
      UNIFI_SITE_MANAGER_SITE_ID: "stdio-sm-site",
      UNIFI_LOG_LEVEL: "error",
      DOTENV_CONFIG_QUIET: "false",
      DOTENV_CONFIG_DEBUG: "true",
      DOTENV_QUIET: "false",
      DOTENV_DEBUG: "true",
    });

    const lines = run.stdout.split("\n").filter((l) => l.trim() !== "");
    expect(lines.length, `stderr: ${run.stderr}`).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      let msg: unknown;
      expect(() => (msg = JSON.parse(line)), `not JSON on stdout: ${line}`).not.toThrow();
      expect(msg).toMatchObject({ jsonrpc: "2.0" });
    }
    const byId = new Map(
      lines
        .map((l) => JSON.parse(l) as { id?: number; result?: { tools?: unknown[] } })
        .map((m) => [m.id, m]),
    );
    expect(byId.get(1)?.result).toBeDefined();
    expect(byId.get(2)?.result?.tools?.length).toBeGreaterThan(0);
    // The process env wins over .env (no override): log level stays "error",
    // so the server's own info line ("connected") is not logged.
    expect(run.stderr).not.toContain("UniFi MCP server connected");
  }, 20_000);
});
