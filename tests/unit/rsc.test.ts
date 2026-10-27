import { describe, expect, it, vi } from "vitest";
import {
  decodeUnicodeEscapes,
  extractEndpointJson,
  fetchEndpointSpec,
} from "../../src/client/rsc.js";

describe("decodeUnicodeEscapes", () => {
  it("decodes \\u escapes", () => {
    expect(decodeUnicodeEscapes("\\u0041BC")).toBe("ABC");
  });
  it("leaves non-escapes intact", () => {
    expect(decodeUnicodeEscapes("plain text")).toBe("plain text");
  });
});

describe("extractEndpointJson", () => {
  it("finds and parses a balanced endpoint block", () => {
    const text = 'noise "endpoint":{"path":"/v1/foo","method":"GET","parameters":[]} more';
    const ep = extractEndpointJson(text);
    expect(ep).toEqual({ path: "/v1/foo", method: "GET", parameters: [] });
  });

  it("handles nested braces in body schemas", () => {
    const text =
      '"endpoint":{"path":"/x","method":"POST","requestBody":{"schema":{"type":"object","properties":{"name":{"type":"string"}}}}}';
    const ep = extractEndpointJson(text);
    expect(ep?.requestBody?.schema?.type).toBe("object");
  });

  it("returns null when not found", () => {
    expect(extractEndpointJson("no endpoint here")).toBeNull();
  });
});

describe("fetchEndpointSpec", () => {
  it("calls developer.ui.com with RSC: 1 header and parses", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        new Response('"endpoint":{"path":"/v1/x","method":"GET"}', { status: 200 }),
      );
    const ep = await fetchEndpointSpec("network/v10.3.58/getinfo", { fetch: f });
    expect(f).toHaveBeenCalledWith(
      "https://developer.ui.com/network/v10.3.58/getinfo",
      expect.objectContaining({ headers: expect.objectContaining({ RSC: "1" }) }),
    );
    expect(ep?.path).toBe("/v1/x");
  });

  it("throws when status is not 2xx", async () => {
    const f = vi.fn().mockResolvedValue(new Response("nope", { status: 404 }));
    await expect(fetchEndpointSpec("network/v10/x", { fetch: f })).rejects.toThrow(/404/);
  });
});
