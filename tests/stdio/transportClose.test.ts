/**
 * How the built server (dist/index.js) ends when its stdio transport closes
 * (audit N-80).
 *
 * stdin reaching end-of-file is the normal end of a session: exit code 0.
 * A transport that closes for any other reason, for example one message above
 * the SDK read-buffer limit (10 MB), ends the session with an `error` log line
 * on stderr and exit code 1, so a supervisor sees the failure. In 0.2.1 the
 * process exited with code 0 and no log line.
 *
 * Runs with `npm run test:stdio` after `npm run build`. Never reaches
 * api.ui.com: dummy key, unreachable base.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ENTRY = `${ROOT}dist/index.js`;
const ENV = {
  PATH: process.env.PATH ?? "",
  UNIFI_API_KEY: "stdio-test-dummy-key",
  UNIFI_API_BASE: "http://127.0.0.1:1",
  UNIFI_LOG_LEVEL: "info",
};

type Run = { stderr: string; code: number | null };

function run(feed: (stdin: NodeJS.WritableStream) => void): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [ENTRY], { env: ENV, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`timeout; stderr=${stderr}`));
    }, 15_000);
    child.stdout.resume();
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    // The server may stop reading before the whole feed is written.
    child.stdin.on("error", () => {});
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ stderr, code });
    });
    feed(child.stdin);
  });
}

describe("stdio transport close (N-80)", () => {
  it("exits 0 without an error line when stdin ends", async () => {
    const r = await run((stdin) => stdin.end());
    expect(r.code).toBe(0);
    expect(r.stderr).not.toMatch(/Z error /);
  });

  it("logs an error and exits 1 when one message exceeds the read-buffer limit", async () => {
    const r = await run((stdin) => {
      // 11 MB without a newline: above the SDK's 10 MB limit for one message.
      // stdin stays open, so only the transport error can end the session.
      stdin.write(Buffer.alloc(11 * 1024 * 1024, 0x78));
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/Z error stdio transport closed/);
    expect(r.stderr).toMatch(/ReadBuffer exceeded maximum size/);
  }, 20_000);
});
