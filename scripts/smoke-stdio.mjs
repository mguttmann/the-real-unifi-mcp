// Stdio smoke test of the built server (audit N-8, done criterion 4).
// Starts dist/index.js with a dummy key and an unreachable API base, sends
// initialize + tools/list over stdio and checks the tool count against the
// committed contract snapshot. Never reaches api.ui.com.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

/** @param {string} text @returns {unknown} */
const parseJson = (text) => JSON.parse(text);

const snapshot = /** @type {{ tools: Array<{ name: string }> }} */ (
  parseJson(readFileSync(new URL("../tests/contract/tools-contract.json", import.meta.url), "utf8"))
);
const expected = snapshot.tools.length;
const child = spawn(process.execPath, ["dist/index.js"], {
  env: {
    PATH: process.env.PATH,
    UNIFI_API_KEY: "smoke-dummy-key",
    UNIFI_API_BASE: "http://127.0.0.1:1",
  },
  stdio: ["pipe", "pipe", "inherit"],
});
const timer = setTimeout(() => fail("timeout after 15 s"), 15_000);
/** @param {string} msg @returns {never} */
function fail(msg) {
  console.error(`stdio smoke FAILED: ${msg}`);
  child.kill();
  process.exit(1);
}
child.on("exit", (code) => fail(`server exited early with code ${code}`));

/**
 * @typedef {{
 *   tools: Array<{ name: string }>,
 *   nextCursor?: string,
 *   serverInfo: { name: string, version: string },
 *   protocolVersion: string,
 * }} Result
 * @typedef {{ id?: number, result: Result, error?: unknown }} Msg
 */
/** @type {Map<number | undefined, (m: Msg) => void>} */
const pending = new Map();
let buf = "";
child.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = /** @type {Msg} */ (parseJson(line));
    pending.get(msg.id)?.(msg);
  }
});
/** @param {object} m */
const send = (m) => child.stdin.write(JSON.stringify(m) + "\n");
/**
 * @param {number} id
 * @param {string} method
 * @param {object} params
 * @returns {Promise<Msg>}
 */
const request = (id, method, params) =>
  new Promise((resolve) => {
    pending.set(id, resolve);
    send({ jsonrpc: "2.0", id, method, params });
  });

const init = await request(1, "initialize", {
  protocolVersion: "2025-11-25",
  capabilities: {},
  clientInfo: { name: "stdio-smoke", version: "0" },
});
if (init.error) fail(`initialize: ${JSON.stringify(init.error)}`);
send({ jsonrpc: "2.0", method: "notifications/initialized" });
/** @type {Array<{ name: string }>} */
const tools = [];
let cursor;
let id = 2;
do {
  const res = await request(id++, "tools/list", cursor ? { cursor } : {});
  if (res.error) fail(`tools/list: ${JSON.stringify(res.error)}`);
  tools.push(...res.result.tools);
  cursor = res.result.nextCursor;
} while (cursor);
if (tools.length !== expected) fail(`expected ${expected} tools, got ${tools.length}`);
const live = new Set(tools.map((t) => t.name));
const missing = snapshot.tools.map((t) => t.name).filter((n) => !live.has(n));
if (missing.length) fail(`snapshot tools missing from tools/list: ${missing.join(", ")}`);
clearTimeout(timer);
child.removeAllListeners("exit");
child.kill();
console.log(
  `stdio smoke OK: ${init.result.serverInfo.name} ${init.result.serverInfo.version}, protocol ${init.result.protocolVersion}, ${tools.length} tools`,
);
