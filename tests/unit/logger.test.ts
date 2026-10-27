import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createLogger,
  formatFatal,
  redactSecrets,
  registerSecretValue,
} from "../../src/utils/logger.js";
import { buildServer } from "../../src/server.js";
import { loadConfig } from "../../src/config.js";

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
    expect(redactSecrets('"X-API-Key": "test-fake-value-12345"')).toContain("***REDACTED***");
  });

  it("redacts apiKey JSON fields", () => {
    expect(redactSecrets('{"apiKey":"secret"}')).toContain("***REDACTED***");
  });

  it("does NOT write to stdout", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    createLogger("debug").info("anything");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  // Audit N-24: earlier patterns missed unquoted header and query forms.
  it("redacts unquoted X-API-Key header and api key query parameters", () => {
    expect(redactSecrets("X-API-Key: fake-key-value-0001")).not.toContain("fake-key-value-0001");
    expect(redactSecrets("GET https://h/x?apikey=fake-key-value-0002&a=1")).not.toContain(
      "fake-key-value-0002",
    );
    expect(redactSecrets("GET https://h/x?api_key=fake-key-value-0003")).not.toContain(
      "fake-key-value-0003",
    );
  });

  it("redacts a registered secret value in any format", () => {
    registerSecretValue("fake-registered-0004");
    expect(redactSecrets("bare fake-registered-0004 in text")).toBe("bare ***REDACTED*** in text");
  });

  it("buildServer registers the configured API key for scrubbing", () => {
    buildServer({
      apiKey: "fake-live-key-0005",
      apiBase: "http://127.0.0.1:1",
      confirmWrites: true,
      timeoutMs: 1000,
      logLevel: "error",
    });
    createLogger("info").info("unlabelled dump fake-live-key-0005");
    const out = String(stderrSpy.mock.calls[0]?.[0] ?? "");
    expect(out).not.toContain("fake-live-key-0005");
    expect(out).toContain("***REDACTED***");
  });

  it("formatFatal scrubs secrets from the fatal stack line", () => {
    registerSecretValue("fake-fatal-key-0006");
    const line = formatFatal(
      new Error("boom with fake-fatal-key-0006 and UNIFI_API_KEY=fake-env-0007"),
    );
    expect(line.startsWith("fatal: ")).toBe(true);
    expect(line).toContain("boom with");
    expect(line).not.toContain("fake-fatal-key-0006");
    expect(line).not.toContain("fake-env-0007");
    expect(formatFatal("plain fake-fatal-key-0006")).toBe("fatal: plain ***REDACTED***\n");
  });
});

describe("redactSecrets: WiFi and other secret fields (N-22)", () => {
  it("redacts quoted JSON secret fields, also with spaces in the value", () => {
    const line = JSON.stringify({
      passphrase: "my wifi pass",
      x_psk: "psk-0001",
      password: "pw-0001",
      ok: "visible",
    });
    const out = redactSecrets(line);
    for (const secret of ["my wifi pass", "psk-0001", "pw-0001"]) expect(out).not.toContain(secret);
    expect(out).toContain("visible");
  });
});

describe("fatal line for a missing key (N-89)", () => {
  it("keeps the word missing", () => {
    let err: unknown;
    try {
      loadConfig({});
    } catch (e) {
      err = e;
    }
    const line = formatFatal(err);
    expect(line).toContain("UNIFI_API_KEY");
    expect(line).toContain("missing or empty");
    expect(line).not.toContain("REDACTED");
  });
});
