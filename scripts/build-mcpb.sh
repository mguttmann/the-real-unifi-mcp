#!/usr/bin/env bash
# Build the MCPB bundle and the CycloneDX SBOMs of its runtime tree.
#
# Usage:  npm run build:mcpb
#
# Output (in release/):
#   the-real-unifi-mcp-<version>.mcpb
#   the-real-unifi-mcp-<version>.mcpb.cdx.json   SBOM of the bundle
#   the-real-unifi-mcp-<version>.tgz.cdx.json    SBOM of the npm package
#
# Every run is a clean build: dist/ is rebuilt with `npm run build` (prebuild:
# lint, typecheck, unit tests), and the bundle's runtime dependencies are
# installed with `npm ci --omit=dev --ignore-scripts` from the committed
# package-lock.json, so the bundle holds exactly the versions CI tested.
# The npm package has the same runtime tree (same lockfile), so both SBOMs
# come from that install.
#
# The manifest is checked with `mcpb validate` from the MCPB CLI pinned as an
# exact dev dependency (`@anthropic-ai/mcpb` in package.json and the lockfile;
# run `npm ci` first).
#
# Reproducible archive: entries sorted, files 0644, one timestamp
# (SOURCE_DATE_EPOCH, by default the commit time of HEAD), no extra zip
# attributes. Two builds of the same commit with the same zip and npm give the
# same bundle bytes. The SBOMs get the same timestamp and a serial number
# derived from their content (scripts/normalize-sbom.mjs), so they are
# reproducible as well.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NAME="$(node -p "require('./package.json').name")"
VERSION="$(node -p "require('./package.json').version")"
OUT_DIR="$ROOT/release"
OUT="$OUT_DIR/${NAME}-${VERSION}.mcpb"

if [ -z "${SOURCE_DATE_EPOCH:-}" ]; then
  SOURCE_DATE_EPOCH="$(git log -1 --format=%ct 2>/dev/null || true)"
fi
if [ -z "$SOURCE_DATE_EPOCH" ]; then
  echo "error: not a git checkout; set SOURCE_DATE_EPOCH (unix seconds)." >&2
  exit 1
fi
export SOURCE_DATE_EPOCH

STAGE_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$STAGE_ROOT"' EXIT
# npm sbom names the root component after the directory.
STAGE="$STAGE_ROOT/$NAME"
mkdir "$STAGE"

if [ ! -x "$ROOT/node_modules/.bin/mcpb" ]; then
  echo "error: MCPB CLI missing; run npm ci first." >&2
  exit 1
fi
echo "-> validate manifest (mcpb $("$ROOT/node_modules/.bin/mcpb" --version))"
"$ROOT/node_modules/.bin/mcpb" validate mcpb/manifest.json

echo "-> clean build"
node -e "require('fs').rmSync('dist', { recursive: true, force: true })"
npm run build

echo "-> stage"
# Compiled runtime only: no code generator (codegen/, client/rsc.js), type declarations or source maps.
( cd dist && find . -type f -name '*.js' ! -path './codegen/*' ! -path './client/rsc.js' -print ) | while read -r f; do
  mkdir -p "$STAGE/dist/$(dirname "$f")"
  cp "dist/$f" "$STAGE/dist/$f"
done
cp mcpb/manifest.json "$STAGE/manifest.json"
cp README.md LICENSE "$STAGE/"
# package.json without scripts (src/constants.ts reads the version from it).
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
delete pkg.scripts;
fs.writeFileSync(process.argv[1], JSON.stringify(pkg, null, 2) + '\n');
" "$STAGE/package.json"
cp package-lock.json "$STAGE/package-lock.json"

echo "-> install runtime dependencies from the lockfile"
( cd "$STAGE" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund )
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
delete pkg.devDependencies;
fs.writeFileSync(process.argv[1], JSON.stringify(pkg, null, 2) + '\n');
" "$STAGE/package.json"

echo "-> SBOMs"
mkdir -p "$OUT_DIR"
rm -f "$OUT" "$OUT.cdx.json" "$OUT_DIR/${NAME}-${VERSION}.tgz.cdx.json"
# npm takes hashes and registry URLs from the lockfile, so it is removed after.
( cd "$STAGE" && npm sbom --sbom-format cyclonedx --sbom-type application ) > "$OUT.cdx.json"
( cd "$STAGE" && npm sbom --sbom-format cyclonedx --sbom-type library ) > "$OUT_DIR/${NAME}-${VERSION}.tgz.cdx.json"
# Timestamp from SOURCE_DATE_EPOCH, serial number from the content (N-74).
node scripts/normalize-sbom.mjs "$OUT.cdx.json"
node scripts/normalize-sbom.mjs "$OUT_DIR/${NAME}-${VERSION}.tgz.cdx.json"
rm -f "$STAGE/package-lock.json" "$STAGE/node_modules/.package-lock.json"

echo "-> pack"
node -e "
const fs = require('fs');
const path = require('path');
const t = Number(process.env.SOURCE_DATE_EPOCH);
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile()) { fs.chmodSync(p, 0o644); fs.utimesSync(p, t, t); }
  }
};
walk(process.argv[1]);
" "$STAGE"
# Regular files only (node_modules/.bin symlinks are not needed at runtime).
( cd "$STAGE" && find . -type f | sed 's|^\./||' | LC_ALL=C sort | TZ=UTC zip -X -q -9 "$OUT" -@ )

echo "Built $OUT (SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH)"
node -e "
const f = process.argv[1];
const h = require('crypto').createHash('sha256').update(require('fs').readFileSync(f)).digest('hex');
console.log('sha256 ' + h + '  ' + require('path').basename(f));
" "$OUT"
