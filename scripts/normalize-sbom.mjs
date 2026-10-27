// Makes a CycloneDX SBOM from `npm sbom` reproducible (audit N-74): npm stamps
// the current time and a random serial number, so two builds of the same
// commit differed. This sets `metadata.timestamp` from SOURCE_DATE_EPOCH and
// derives `serialNumber` (a version-5 style UUID) from a SHA-256 of the SBOM
// without those two fields.
//
// Usage: SOURCE_DATE_EPOCH=<unix seconds> node scripts/normalize-sbom.mjs <file>...
// (rewrites each file in place; scripts/build-mcpb.sh calls it).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** @param {string} text @returns {unknown} */
const parseJson = (text) => JSON.parse(text);

/**
 * @param {string} text SBOM JSON as written by `npm sbom`
 * @param {number} epoch SOURCE_DATE_EPOCH in seconds
 * @returns {string} normalised SBOM JSON (two-space indent, trailing newline)
 */
export function normalizeSbom(text, epoch) {
  if (!Number.isInteger(epoch) || epoch < 0) {
    throw new Error(`SOURCE_DATE_EPOCH must be unix seconds, got ${String(epoch)}`);
  }
  /** @typedef {{ serialNumber?: string, metadata?: { timestamp?: string } }} Sbom */
  const sbom = /** @type {Sbom} */ (parseJson(text));
  // Hash a copy without the two run-dependent fields; then overwrite them in
  // place, so the key order of npm's output is kept.
  const copy = /** @type {Sbom} */ (parseJson(text));
  delete copy.serialNumber;
  if (copy.metadata) delete copy.metadata.timestamp;
  const hex = createHash("sha256").update(JSON.stringify(copy)).digest("hex");
  const variant = ((parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  const uuid = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
  sbom.serialNumber = `urn:uuid:${uuid}`;
  sbom.metadata = { ...sbom.metadata, timestamp: new Date(epoch * 1000).toISOString() };
  return JSON.stringify(sbom, null, 2) + "\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const epoch = Number(process.env.SOURCE_DATE_EPOCH);
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("usage: node scripts/normalize-sbom.mjs <sbom.cdx.json>...");
    process.exit(2);
  }
  for (const f of files) writeFileSync(f, normalizeSbom(readFileSync(f, "utf8"), epoch));
}
