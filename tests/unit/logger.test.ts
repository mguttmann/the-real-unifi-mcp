import { describe, expect, it, vi, beforeEach } from "vitest";
import { createLogger, redactSecrets } from "../../src/utils/logger.js";

describe("logger", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  it("writes info messages to stderr", () => {
    const log = createLogger("info");
    log.info("hello");
    expect(stderrSpy).toHaveBeenCalled();
    const out = String(stderrSpy.mock.calls[0]?.[0] ?? "");
    expect(out).toContain("hello");
    expect(out).toContain("info");
  });

  it("filters debug messages when level=info", () => {
    const log = createLogger("info");
    log.debug("noisy");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("redacts UNIFI_API_KEY=value patterns", () => {
    expect(redactSecrets("UNIFI_API_KEY=abc123def")).toBe("UNIFI_API_KEY=***REDACTED***");
  });

  it("redacts X-API-Key header values", () => {
    expect(redactSecrets('"X-API-Key": "vGQl99JC"')).toContain("***REDACTED***");
  });

  it("redacts apiKey JSON fields", () => {
    expect(redactSecrets('{"apiKey":"secret"}')).toContain("***REDACTED***");
  });

  it("does NOT write to stdout", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    createLogger("debug").info("anything");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
