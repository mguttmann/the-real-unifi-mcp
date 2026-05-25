import { describe, expect, it } from "vitest";
import { UnifiApiError, parseApiError } from "../../src/client/errors.js";

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
});
