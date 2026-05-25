#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
OUT="the-real-unifi-mcp-${VERSION}.mcpb"
STAGING="$(mktemp -d)"

echo "→ build"
npm run build

echo "→ stage"
cp -r dist "$STAGING/"
cp package.json "$STAGING/"
cp README.md "$STAGING/" 2>/dev/null || true
cp LICENSE "$STAGING/" 2>/dev/null || true
cp mcpb/manifest.json "$STAGING/manifest.json"

echo "→ install production deps in staging"
(cd "$STAGING" && npm install --omit=dev --no-audit --no-fund --quiet)

echo "→ bundle"
(cd "$STAGING" && zip -qr "$ROOT/$OUT" .)

rm -rf "$STAGING"
echo "✓ wrote $OUT"
