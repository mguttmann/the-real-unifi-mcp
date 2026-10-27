import { describe, expect, it } from "vitest";
import { errorResult, jsonResult, redactBody } from "../../src/tools/helpers.js";

describe("jsonResult", () => {
  it("wraps data in MCP content text", () => {
    const r = jsonResult({ a: 1 });
    expect(r.content[0]).toMatchObject({ type: "text" });
    expect(JSON.parse((r.content[0] as { text: string }).text)).toEqual({ data: { a: 1 } });
    expect(r.isError).toBeUndefined();
  });

  it("attaches pagination note when present", () => {
    const r = jsonResult(
      { items: [1, 2] },
      { pagination: { hasMore: true, nextOffset: 50, totalCount: 200, returned: 50 } },
    );
    const text = (r.content[0] as { text: string }).text;
    expect(text).toContain("nextOffset");
    expect(text).toContain("200");
  });
});

describe("errorResult", () => {
  it("marks isError true and returns the message", () => {
    const r = errorResult("boom");
    expect(r.isError).toBe(true);
    expect((r.content[0] as { text: string }).text).toContain("boom");
  });
});

describe("redactBody", () => {
  it("redacts password/key/secret/token keys recursively", () => {
    const r = redactBody({
      user: "u",
      password: "p",
      nested: { apiKey: "k", token: "t", ok: "ok" },
    });
    expect(r).toEqual({
      user: "u",
      password: "(redacted)",
      nested: { apiKey: "(redacted)", token: "(redacted)", ok: "ok" },
    });
  });
  it("handles arrays", () => {
    expect(redactBody([{ secret: "s" }, { ok: "o" }])).toEqual([
      { secret: "(redacted)" },
      { ok: "o" },
    ]);
  });
  it("returns primitives unchanged", () => {
    expect(redactBody("plain")).toBe("plain");
    expect(redactBody(42)).toBe(42);
  });
});

describe("redactBody: WiFi and other secrets (N-22)", () => {
  it("redacts passphrases, PSKs and similar secret fields", () => {
    const r = redactBody({
      name: "Office",
      securityConfiguration: {
        type: "WPA2_PERSONAL",
        passphrase: "wifi-pass-1",
        presharedKeys: [{ key: "ppsk-1", networkId: "n1" }],
        presharedKeyNetworkIds: ["n1"],
      },
      x_passphrase: "wifi-pass-2",
      wpa_psk: "wifi-pass-3",
      x_secret: "radius-1",
      privateKey: "pk-1",
      wepKey: "wep-1",
    }) as Record<string, unknown>;
    const text = JSON.stringify(r);
    for (const secret of [
      "wifi-pass-1",
      "ppsk-1",
      "wifi-pass-2",
      "wifi-pass-3",
      "radius-1",
      "pk-1",
      "wep-1",
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain("WPA2_PERSONAL");
    expect(text).toContain('"presharedKeyNetworkIds":["n1"]');
    expect(r.name).toBe("Office");
  });
});
