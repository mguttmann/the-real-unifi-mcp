/**
 * Tool input element ceiling (audit N-33).
 *
 * SDK >= 1.32 counts array elements and object members of a tools/call
 * `arguments` payload before schema validation and refuses it above
 * `maxToolInputElements`. Unset means no limit, so the server sets it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "@modelcontextprotocol/client";
import { connectInProcess } from "../contract/liveTools.js";
import { MAX_TOOL_INPUT_ELEMENTS } from "../../src/constants.js";

let client: Client;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ client, close } = await connectInProcess());
});
afterAll(async () => {
  await close();
});

// A write without confirm only returns the preview, so no request is sent.
const rawPost = (body: unknown) =>
  client.callTool({
    name: "unifi_raw_request",
    arguments: { method: "POST", path: "/v1/x", body },
  });

async function outcome(body: unknown): Promise<{ isError: boolean; text: string }> {
  try {
    const res = await rawPost(body);
    const content = res.content as Array<{ type: string; text?: string }>;
    return { isError: res.isError === true, text: content.map((c) => c.text ?? "").join("\n") };
  } catch (err) {
    return { isError: true, text: String(err) };
  }
}

describe("maxToolInputElements", () => {
  it("is a finite limit well above any real tool input", () => {
    expect(Number.isFinite(MAX_TOOL_INPUT_ELEMENTS)).toBe(true);
    expect(MAX_TOOL_INPUT_ELEMENTS).toBeGreaterThanOrEqual(10_000);
  });

  it("accepts arguments within the limit", async () => {
    const res = await outcome(new Array(1000).fill(0));
    expect(res.isError).toBe(false);
  });

  it("refuses arguments above the limit before validation", async () => {
    const res = await outcome(new Array(MAX_TOOL_INPUT_ELEMENTS + 1).fill(0));
    expect(res.isError).toBe(true);
    expect(res.text).toContain(`maximum of ${MAX_TOOL_INPUT_ELEMENTS} elements`);
  });
});
