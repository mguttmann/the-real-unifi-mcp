/**
 * 0.3.1: a write tool refuses a body that contains the placeholder
 * UNIFI_REDACT_SECRETS (and the confirm preview) put in place of a secret, in
 * any field at any depth. Without this, a WiFi broadcast read with redaction
 * on and written back unchanged would set the passphrase to "(redacted)".
 * The check is in the shared write guard, before dry_run and the confirm
 * preview, and is always on.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { connectInProcess } from "../contract/liveTools.js";
import { REDACTED_PLACEHOLDER, redactedPaths } from "../../src/tools/helpers.js";

const WIFI_ID = "00000000-0000-4000-8000-000000000001";

function stubFetch(payload: unknown = { ok: true }) {
  const f = vi.fn(
    async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", f);
  return f;
}

const text = (res: unknown) =>
  ((res as CallToolResult).content as Array<{ text?: string }>)[0]?.text ?? "";

function expectRejected(res: unknown, paths: string[]) {
  const r = res as CallToolResult;
  expect(r.isError, text(res)).toBe(true);
  const payload = JSON.parse(text(res)) as { error: string; details: { code: string } };
  expect(payload.details.code).toBe("REDACTED_PLACEHOLDER");
  for (const p of paths) expect(payload.error).toContain(p);
  expect(payload.error).toContain("UNIFI_REDACT_SECRETS");
  expect(text(res)).not.toContain(`"preview":`);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("redactedPaths", () => {
  it("names every field whose value is exactly the placeholder, objects and arrays", () => {
    expect(REDACTED_PLACEHOLDER).toBe("(redacted)");
    expect(
      redactedPaths({
        name: "Home",
        securityConfiguration: { type: "WPA2", passphrase: "(redacted)" },
        list: ["ok", "(redacted)", { key: "(redacted)" }],
        note: "contains (redacted) inside",
      }),
    ).toEqual(["body.securityConfiguration.passphrase", "body.list[1]", "body.list[2].key"]);
    expect(redactedPaths("(redacted)")).toEqual(["body"]);
    expect(redactedPaths({ "a b": "(redacted)" })).toEqual(['body["a b"]']);
    expect(redactedPaths({ a: "secret", b: [1, null, true] })).toEqual([]);
    expect(redactedPaths(undefined)).toEqual([]);
  });
});

describe("write tools refuse the redaction placeholder (0.3.1)", () => {
  const wifiBody = {
    name: "Home",
    securityConfiguration: { type: "WPA2_PERSONAL", passphrase: "(redacted)" },
  };

  for (const [label, cfg, extra] of [
    ["confirm on, no confirm (would preview)", {}, {}],
    ["confirm on, confirm YES", {}, { confirm: "YES" }],
    ["confirm off", { confirmWrites: false }, {}],
    ["dry_run", {}, { dry_run: true }],
    ["dry_run with confirm off", { confirmWrites: false }, { dry_run: true }],
  ] as const) {
    it(`unifi_net_update_wifi, nested passphrase: ${label}`, async () => {
      const f = stubFetch();
      const { client, close } = await connectInProcess(cfg);
      try {
        const res = await client.callTool({
          name: "unifi_net_update_wifi",
          arguments: { id: WIFI_ID, body: wifiBody, ...extra },
        });
        expectRejected(res, ["body.securityConfiguration.passphrase"]);
        expect(text(res)).not.toContain("Home");
      } finally {
        await close();
      }
      expect(f).not.toHaveBeenCalled();
    });
  }

  it("also with UNIFI_REDACT_SECRETS off and UNIFI_READ_ONLY off (always on)", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess({
      confirmWrites: false,
      redactSecrets: false,
      readOnly: false,
    });
    try {
      const res = await client.callTool({
        name: "unifi_net_create_wifi",
        arguments: { body: wifiBody },
      });
      expectRejected(res, ["body.securityConfiguration.passphrase"]);
    } finally {
      await close();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("unifi_raw_request PUT with a nested placeholder", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess({ confirmWrites: false });
    try {
      const res = await client.callTool({
        name: "unifi_raw_request",
        arguments: {
          method: "PUT",
          path: `/v1/sites/s/wifi/broadcasts/${WIFI_ID}`,
          body: { a: { b: [{ psk: "(redacted)" }] }, radius: { secret: "(redacted)" } },
        },
      });
      expectRejected(res, ["body.a.b[0].psk", "body.radius.secret"]);
    } finally {
      await close();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("a generated write tool (unifi_gen_updatewifibroadcast), confirm YES", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({
        name: "unifi_gen_updatewifibroadcast",
        arguments: { wifiBroadcastId: WIFI_ID, body: wifiBody, confirm: "YES" },
      });
      expectRejected(res, ["body.securityConfiguration.passphrase"]);
    } finally {
      await close();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("the placeholder in an array element", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess({ confirmWrites: false });
    try {
      const res = await client.callTool({
        name: "unifi_net_update_wifi",
        arguments: {
          id: WIFI_ID,
          body: { name: "Home", presharedKeys: ["real-key-1", "(redacted)"] },
        },
      });
      expectRejected(res, ["body.presharedKeys[1]"]);
      expect(text(res)).not.toContain("real-key-1");
    } finally {
      await close();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("a WiFi body read with UNIFI_REDACT_SECRETS on and written back is refused", async () => {
    const stored = {
      id: WIFI_ID,
      name: "Home",
      securityConfiguration: { type: "WPA2_PERSONAL", passphrase: "hunter2-real" },
    };
    const f = stubFetch(stored);
    const { client, close } = await connectInProcess({ redactSecrets: true, confirmWrites: false });
    try {
      const read = await client.callTool({
        name: "unifi_net_get_wifi",
        arguments: { id: WIFI_ID },
      });
      const body = (JSON.parse(text(read)) as { data: unknown }).data;
      expect(body).toMatchObject({ securityConfiguration: { passphrase: "(redacted)" } });
      f.mockClear();
      const res = await client.callTool({
        name: "unifi_net_update_wifi",
        arguments: { id: WIFI_ID, body },
      });
      expectRejected(res, ["body.securityConfiguration.passphrase"]);
    } finally {
      await close();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("a body without the placeholder is still sent", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess({ confirmWrites: false });
    try {
      const body = {
        name: "Home",
        note: "text that mentions (redacted) is not the placeholder",
        securityConfiguration: { type: "WPA2_PERSONAL", passphrase: "new-passphrase-1" },
      };
      const res = await client.callTool({
        name: "unifi_net_update_wifi",
        arguments: { id: WIFI_ID, body },
      });
      expect(res.isError, text(res)).toBeFalsy();
      expect(f).toHaveBeenCalledTimes(1);
      const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
      expect(JSON.parse(init.body as string)).toEqual(body);
    } finally {
      await close();
    }
  });

  it("a body without the placeholder still gets the confirm preview", async () => {
    const f = stubFetch();
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({
        name: "unifi_net_update_wifi",
        arguments: { id: WIFI_ID, body: { name: "Home" } },
      });
      expect(res.isError, text(res)).toBeFalsy();
      expect(text(res)).toContain("preview");
    } finally {
      await close();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("read tools are unaffected, also unifi_raw_request GET", async () => {
    const f = stubFetch({ data: [{ passphrase: "(redacted)" }] });
    const { client, close } = await connectInProcess();
    try {
      for (const [name, args] of [
        ["unifi_net_get_wifi", { id: WIFI_ID }],
        ["unifi_net_list_wifi", {}],
        ["unifi_raw_request", { method: "GET", path: "/v1/hosts", body: "(redacted)" }],
        [
          "unifi_raw_request",
          { method: "GET", path: "/v1/hosts", body: { a: "(redacted)" }, dry_run: true },
        ],
      ] as const) {
        const res = await client.callTool({ name, arguments: args });
        expect(res.isError, `${name}: ${text(res)}`).toBeFalsy();
      }
    } finally {
      await close();
    }
    // The dry_run GET previews and sends nothing.
    expect(f).toHaveBeenCalledTimes(3);
  });
});
