/**
 * MCPB placeholders (0.3.0 review): `mcpb/manifest.json` maps user settings to
 * environment variables as `${user_config.<key>}`. A host that does not
 * substitute them starts the server with that literal text. Such a value is
 * treated as unset (the default of the switch) and logged as a warning, never
 * as an unknown value: before, `UNIFI_READ_ONLY` and `UNIFI_REDACT_SECRETS`
 * turned on, and `UNIFI_LOG_LEVEL` stopped the server.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig, MCPB_MAPPED_ENV } from "../../src/config.js";

const manifest = JSON.parse(
  readFileSync(new URL("../../mcpb/manifest.json", import.meta.url), "utf8"),
) as { server: { mcp_config: { env: Record<string, string> } } };
const mapping = manifest.server.mcp_config.env;

/** The environment of a host that passes the manifest mapping on unchanged. */
function unsubstituted(except: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...mapping, ...except };
}

describe("unsubstituted MCPB placeholders", () => {
  it("the config handles exactly the variables the manifest maps", () => {
    expect([...MCPB_MAPPED_ENV].sort()).toEqual(Object.keys(mapping).sort());
    for (const v of Object.values(mapping)) expect(v).toMatch(/^\$\{user_config\.\w+\}$/);
  });

  it("every switch takes its default and each placeholder is named in a warning", () => {
    const warnings: string[] = [];
    const cfg = loadConfig(unsubstituted({ UNIFI_API_KEY: "k" }), (m) => warnings.push(m));
    const defaults = loadConfig({ UNIFI_API_KEY: "k" }, () => {});
    expect(cfg.confirmWrites).toBe(defaults.confirmWrites);
    expect(cfg.readOnly).toBe(false);
    expect(cfg.redactSecrets).toBe(false);
    expect(cfg.logLevel).toBe(defaults.logLevel);
    for (const name of Object.keys(mapping).filter((n) => n !== "UNIFI_API_KEY")) {
      expect(warnings.some((w) => w.startsWith(`${name} `) && w.includes("treated as unset"))).toBe(
        true,
      );
    }
    expect(warnings).toHaveLength(Object.keys(mapping).length - 1);
  });

  it("an unsubstituted API key counts as missing, so the server does not start", () => {
    const warnings: string[] = [];
    expect(() => loadConfig(unsubstituted(), (m) => warnings.push(m))).toThrow(
      "Invalid config: UNIFI_API_KEY is missing or empty",
    );
    expect(warnings.some((w) => w.startsWith("UNIFI_API_KEY "))).toBe(true);
  });

  it("substituted values and other unknown values keep their meaning", () => {
    const warnings: string[] = [];
    const cfg = loadConfig(
      {
        UNIFI_API_KEY: "k",
        UNIFI_READ_ONLY: "maybe",
        UNIFI_REDACT_SECRETS: "true",
        UNIFI_CONFIRM_WRITES: "false",
        UNIFI_LOG_LEVEL: "debug",
      },
      (m) => warnings.push(m),
    );
    expect(cfg).toMatchObject({
      readOnly: true,
      redactSecrets: true,
      confirmWrites: false,
      logLevel: "debug",
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^UNIFI_READ_ONLY=.*treated as on$/);
  });

  it("leaves the caller's environment object unchanged", () => {
    const env = unsubstituted({ UNIFI_API_KEY: "k" });
    const before = { ...env };
    loadConfig(env, () => {});
    expect(env).toEqual(before);
  });
});
