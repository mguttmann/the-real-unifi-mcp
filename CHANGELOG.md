# Changelog

## [0.1.2] — 2026-06-14

### Security
- Fix CRITICAL SSRF / API-key exfiltration in `unifi_raw_request`. `buildUrl` now enforces a same-origin allow-list, so a caller-supplied absolute or protocol-relative `path` can no longer redirect the live `X-API-Key` to a non-UniFi host; a defense-in-depth `path` regex rejects such inputs at the schema boundary, backed by a regression test (`tests/unit/ssrf.test.ts`).
- Register the live API key for startup log-scrubbing (value-based redaction), so the key is masked in all log output regardless of format; hardened secret-redaction patterns and `.gitignore`.

### Changed
- Safe in-range dev-dependency upgrades (resolves a transitive esbuild advisory).
- `SERVER_VERSION` aligned with the package version.
- Removed dead code; polished public-facing docs.
- Reconciled tool-count wording: 167 = 80 generated + 76 network + 10 site-manager + 1 raw.

## [0.1.1] — 2026-05-25

### Added
- `@eslint/js` as an explicit devDependency. Earlier it was relied upon transitively from `eslint@9`; making it explicit so future major-version ESLint updates do not break the lint script.

### Changed
- Dependabot configuration tightened: dev-dependencies grouped only for minor/patch updates; major bumps for `zod`, `eslint`, `@eslint/js`, `typescript-eslint`, `@typescript-eslint/*` are ignored (they require manual migration).
- Replaced an API-key-shaped fixture string in `tests/unit/logger.test.ts` with a clearly fictional placeholder.

## [0.1.0] — 2026-05-25

### Added
- Initial scaffold: TypeScript MCP server (stdio), `@modelcontextprotocol/sdk` 1.x.
- Three tool layers covering Site Manager + Network APIs (complete coverage of the documented API surface via codegen + hand-wrappers).
  - 10 Site Manager hand-wrappers (`unifi_sm_*`)
  - 76 Network hand-wrappers (`unifi_net_*`)
  - 80 auto-generated tools (`unifi_gen_*`) from UniFi developer docs
  - 1 escape-hatch (`unifi_raw_request`)
- Discovery (consoleId + siteIds) with env-overrides and process-lifetime caching.
- Optional `UNIFI_CONFIRM_WRITES` preview/confirm flow for destructive tools.
- Resources (`unifi://identity`, `unifi://hosts[/id]`) and prompts (audit-firewall, network-health, adoption-status).
- MCPB bundle script (`npm run build:mcpb`).
- Vitest unit tests (94 passing) + live read-only integration tests (skipped without API key).
- ESLint 9 (flat) + Prettier 3 + strict TypeScript with `noUncheckedIndexedAccess`.

### Security
- API key only via env (`UNIFI_API_KEY`). Never logged.
- Logger redacts known secret patterns.
