import { describe, expect, it } from "vitest";
import { UnifiApiError, parseApiError } from "../../src/client/errors.js";
import { MAX_UPSTREAM_ERROR_CHARS } from "../../src/constants.js";
import { registerSecretValue } from "../../src/utils/logger.js";

describe("UnifiApiError", () => {
  it("captures status, statusName, code, message", () => {
    const e = new UnifiApiError({
      statusCode: 404,
      statusName: "NOT_FOUND",
      code: "api.request.error",
      message: "site not found",
    });
    expect(e.statusCode).toBe(404);
    expect(e.message).toContain("site not found");
    expect(e.code).toBe("api.request.error");
    expect(e instanceof Error).toBe(true);
  });
});

describe("parseApiError", () => {
  it("parses canonical UniFi error JSON", () => {
    const text = JSON.stringify({
      statusCode: 404,
      statusName: "NOT_FOUND",
      code: "api.request.error",
      message: "nope",
    });
    const e = parseApiError(text, 404);
    expect(e.statusCode).toBe(404);
    expect(e.message).toContain("nope");
  });

  it("falls back to generic message for non-JSON body", () => {
    const e = parseApiError("<html>500</html>", 500);
    expect(e.statusCode).toBe(500);
    expect(e.message).toContain("500");
  });

  it("falls back when JSON is valid but missing fields", () => {
    const e = parseApiError(JSON.stringify({ foo: "bar" }), 502);
    expect(e.statusCode).toBe(502);
  });

  it("caps a long JSON message and a long non-JSON body (N-25)", () => {
    const long = "x".repeat(MAX_UPSTREAM_ERROR_CHARS * 4);
    const fromJson = parseApiError(JSON.stringify({ message: long }), 400);
    const fromText = parseApiError(long, 502);
    for (const e of [fromJson, fromText]) {
      expect(e.message.length).toBeLessThan(MAX_UPSTREAM_ERROR_CHARS + 50);
      expect(e.message).toContain("(truncated)");
    }
  });

  it("scrubs secrets from upstream error text in both branches (N-25)", () => {
    registerSecretValue("fake-registered-key-0025");
    const json = parseApiError(
      JSON.stringify({ message: 'bad "passphrase":"hunter2-wifi" key fake-registered-key-0025' }),
      400,
    );
    const html = parseApiError("<p>X-API-Key: fake-registered-key-0025</p>", 502);
    for (const e of [json, html]) {
      expect(e.message).not.toContain("fake-registered-key-0025");
      expect(e.message).toContain("***REDACTED***");
    }
    expect(json.message).not.toContain("hunter2-wifi");
  });
});
