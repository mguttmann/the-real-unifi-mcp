import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createContext } from "../../src/server.js";

const SAVED = { ...process.env };
afterEach(() => {
  process.env = { ...SAVED };
});

describe("loadConfig", () => {
  beforeEach(() => {
    delete process.env.UNIFI_API_KEY;
    delete process.env.UNIFI_CONFIRM_WRITES;
    delete process.env.UNIFI_TIMEOUT_MS;
    delete process.env.UNIFI_API_BASE;
    delete process.env.UNIFI_LOG_LEVEL;
    delete process.env.UNIFI_CONSOLE_ID;
    delete process.env.UNIFI_NETWORK_SITE_ID;
    delete process.env.UNIFI_SITE_MANAGER_SITE_ID;
  });

  it("throws when UNIFI_API_KEY is missing", () => {
    expect(() => loadConfig()).toThrow(/UNIFI_API_KEY/);
  });

  it("loads minimal valid config", () => {
    process.env.UNIFI_API_KEY = "abc";
    const cfg = loadConfig();
    expect(cfg.apiKey).toBe("abc");
    expect(cfg.apiBase).toBe("https://api.ui.com");
    expect(cfg.confirmWrites).toBe(true);
    expect(cfg.timeoutMs).toBe(30_000);
    expect(cfg.logLevel).toBe("info");
  });

  it("keeps confirmWrites on unless it is explicitly off (fail closed, N-3)", () => {
    process.env.UNIFI_API_KEY = "abc";
    for (const v of ["true", "1", "yes", "on", "TRUE", " On ", ""]) {
      process.env.UNIFI_CONFIRM_WRITES = v;
      const warnings: string[] = [];
      expect(
        loadConfig(process.env, (w) => warnings.push(w)).confirmWrites,
        JSON.stringify(v),
      ).toBe(true);
      expect(warnings, JSON.stringify(v)).toEqual([]);
    }
    for (const v of ["false", "0", "no", "off", "FALSE", " Off "]) {
      process.env.UNIFI_CONFIRM_WRITES = v;
      expect(loadConfig().confirmWrites, JSON.stringify(v)).toBe(false);
    }
  });

  it("keeps confirmWrites on for an unknown value and warns", () => {
    process.env.UNIFI_API_KEY = "abc";
    for (const v of ["enabled", "disable", "nope", "2"]) {
      process.env.UNIFI_CONFIRM_WRITES = v;
      const warnings: string[] = [];
      expect(loadConfig(process.env, (w) => warnings.push(w)).confirmWrites, v).toBe(true);
      expect(warnings.length, v).toBe(1);
      expect(warnings[0]).toContain("UNIFI_CONFIRM_WRITES");
      expect(warnings[0]).toContain(JSON.stringify(v));
    }
  });

  it("accepts https and loopback http for UNIFI_API_BASE (N-31)", () => {
    process.env.UNIFI_API_KEY = "abc";
    for (const v of [
      "https://api.ui.com",
      "https://api.ui.com/",
      "https://example.test:8443",
      "http://127.0.0.1:1",
      "http://localhost:8080/",
      "http://[::1]:9000",
    ]) {
      process.env.UNIFI_API_BASE = v;
      expect(loadConfig().apiBase, v).toBe(v);
    }
  });

  it("rejects other schemes, plain http to other hosts and a path, query or credentials in UNIFI_API_BASE", () => {
    process.env.UNIFI_API_KEY = "abc";
    for (const v of [
      "http://api.ui.com",
      "http://10.0.0.1",
      "http://127.0.0.1.example.com",
      "ftp://api.ui.com",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://api.ui.com/v1",
      "https://api.ui.com/?x=1",
      "https://api.ui.com/#frag",
      "https://user:pw@api.ui.com",
      "not a url",
    ]) {
      process.env.UNIFI_API_BASE = v;
      expect(() => loadConfig(), v).toThrow(/Invalid config for UNIFI_API_BASE/);
    }
  });

  it("validates logLevel enum", () => {
    process.env.UNIFI_API_KEY = "abc";
    process.env.UNIFI_LOG_LEVEL = "garbage";
    expect(() => loadConfig()).toThrow(/UNIFI_LOG_LEVEL/);
  });

  it("validates timeoutMs is positive number", () => {
    process.env.UNIFI_API_KEY = "abc";
    process.env.UNIFI_TIMEOUT_MS = "-1";
    expect(() => loadConfig()).toThrow(/UNIFI_TIMEOUT_MS/);
  });

  it("propagates optional override IDs", () => {
    process.env.UNIFI_API_KEY = "abc";
    process.env.UNIFI_CONSOLE_ID = "C1";
    process.env.UNIFI_NETWORK_SITE_ID = "N1";
    process.env.UNIFI_SITE_MANAGER_SITE_ID = "S1";
    const cfg = loadConfig();
    expect(cfg.consoleIdOverride).toBe("C1");
    expect(cfg.networkSiteIdOverride).toBe("N1");
    expect(cfg.siteManagerSiteIdOverride).toBe("S1");
  });

  it("logs an unknown UNIFI_CONFIRM_WRITES at warn when the server context starts", () => {
    process.env.UNIFI_API_KEY = "abc";
    process.env.UNIFI_CONFIRM_WRITES = "enabled";
    const lines: string[] = [];
    const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    try {
      expect(createContext().cfg.confirmWrites).toBe(true);
    } finally {
      spy.mockRestore();
    }
    expect(lines.some((l) => / warn UNIFI_CONFIRM_WRITES="enabled"/.test(l))).toBe(true);
  });
});
