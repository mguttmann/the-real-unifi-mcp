import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

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
    expect(cfg.confirmWrites).toBe(false);
    expect(cfg.timeoutMs).toBe(30_000);
    expect(cfg.logLevel).toBe("info");
  });

  it("parses confirmWrites flag with multiple truthy spellings", () => {
    process.env.UNIFI_API_KEY = "abc";
    for (const v of ["true", "1", "yes", "TRUE", " true "]) {
      process.env.UNIFI_CONFIRM_WRITES = v;
      expect(loadConfig().confirmWrites).toBe(true);
    }
    for (const v of ["false", "0", "no", ""]) {
      process.env.UNIFI_CONFIRM_WRITES = v;
      expect(loadConfig().confirmWrites).toBe(false);
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
});
