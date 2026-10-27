/**
 * Size of the tools/list response (0.3.0 review). Gateways and clients load
 * every tool schema into the model context, and some limit the size per tool.
 * 0.3.0 first carried the full vendor request schema in `body` (about 276 KB,
 * 55 KB for one tool); generated bodies now list the top-level fields only.
 * Measured as the UTF-8 bytes of JSON.stringify({ tools }), as sent on the wire
 * without the JSON-RPC envelope. Raising a cap is a decision for the CHANGELOG.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { Tool } from "@modelcontextprotocol/server";
import { listLiveTools } from "../contract/liveTools.js";

const MAX_TOTAL_BYTES = 120_000;
const MAX_TOOL_BYTES = 4_000;

let tools: Tool[];

beforeAll(async () => {
  tools = (await listLiveTools()).tools;
});

const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v), "utf8");

describe("tools/list size", () => {
  it(`stays below ${MAX_TOTAL_BYTES} bytes in total`, () => {
    expect(bytes({ tools })).toBeLessThan(MAX_TOTAL_BYTES);
  });

  it(`keeps every single tool below ${MAX_TOOL_BYTES} bytes`, () => {
    const big = tools
      .map((t) => [t.name, bytes(t)] as const)
      .filter(([, n]) => n >= MAX_TOOL_BYTES);
    expect(big).toEqual([]);
  });
});
