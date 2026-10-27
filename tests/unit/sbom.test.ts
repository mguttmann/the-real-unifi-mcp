/**
 * Reproducible SBOMs (audit N-74): `npm sbom` stamps the current time and a
 * random serial number. scripts/normalize-sbom.mjs replaces the timestamp with
 * SOURCE_DATE_EPOCH and derives the serial from the SBOM content, so two
 * builds of the same commit give the same SBOM bytes and the same SHA256SUMS.
 */
import { describe, expect, it } from "vitest";
import { normalizeSbom } from "../../scripts/normalize-sbom.mjs";

function sbom(timestamp: string, serial: string, component = "zod") {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: serial,
    version: 1,
    metadata: { timestamp, component: { name: "the-real-unifi-mcp" } },
    components: [{ name: component, version: "4.6.7" }],
  };
}

const EPOCH = 1_793_000_000;

describe("normalizeSbom (N-74)", () => {
  it("gives the same bytes for two runs that differ only in timestamp and serial", () => {
    const a = normalizeSbom(
      JSON.stringify(sbom("2026-10-27T10:00:00.000Z", "urn:uuid:1111")),
      EPOCH,
    );
    const b = normalizeSbom(
      JSON.stringify(sbom("2026-10-28T11:11:11.111Z", "urn:uuid:2222")),
      EPOCH,
    );
    expect(a).toBe(b);
  });

  it("sets the timestamp from SOURCE_DATE_EPOCH and a UUID serial from the content", () => {
    const out = JSON.parse(normalizeSbom(JSON.stringify(sbom("x", "y")), EPOCH)) as {
      serialNumber: string;
      metadata: { timestamp: string };
    };
    expect(out.metadata.timestamp).toBe(new Date(EPOCH * 1000).toISOString());
    expect(out.serialNumber).toMatch(
      /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("gives a different serial for different content", () => {
    const a = JSON.parse(normalizeSbom(JSON.stringify(sbom("x", "y", "zod")), EPOCH)) as {
      serialNumber: string;
    };
    const b = JSON.parse(normalizeSbom(JSON.stringify(sbom("x", "y", "dotenv")), EPOCH)) as {
      serialNumber: string;
    };
    expect(a.serialNumber).not.toBe(b.serialNumber);
  });

  it("refuses a missing or invalid epoch", () => {
    expect(() => normalizeSbom(JSON.stringify(sbom("x", "y")), Number.NaN)).toThrow(
      /SOURCE_DATE_EPOCH/,
    );
  });
});
