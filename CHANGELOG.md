# Changelog

## [0.1.1] — 2026-05-25

### Added
- `@eslint/js` as an explicit devDependency. Earlier it was relied upon transitively from `eslint@9`; making it explicit so future major-version ESLint updates do not break the lint script.

### Changed
- Dependabot configuration tightened: dev-dependencies grouped only for minor/patch updates; major bumps for `zod`, `eslint`, `@eslint/js`, `typescript-eslint`, `@typescript-eslint/*` are ignored (they require manual migration).
- Replaced an API-key-shaped fixture string in `tests/unit/logger.test.ts` with a clearly fictional placeholder.

## [0.1.0] — 2026-05-25

### Added
- Initial scaffold: TypeScript MCP server (stdio), `@modelcontextprotocol/sdk` 1.x.
- Three tool layers covering Site Manager + Network APIs (100% coverage via codegen + hand-wrappers).
  - 10 Site Manager hand-wrappers (`unifi_sm_*`)
  - ~75 Network hand-wrappers (`unifi_net_*`)
  - 80 auto-generated tools (`unifi_gen_*`) from UniFi developer docs
  - 1 escape-hatch (`unifi_raw_request`)
- Discovery (consoleId + siteIds) with env-overrides and process-lifetime caching.
- Optional `UNIFI_CONFIRM_WRITES` preview/confirm flow for destructive tools.
- Resources (`unifi://identity`, `unifi://hosts[/id]`) and prompts (audit-firewall, network-health, adoption-status).
- MCPB bundle script (`npm run build:mcpb`).
- Vitest unit tests (87 passing) + live read-only integration tests (skipped without API key).
- ESLint 9 (flat) + Prettier 3 + strict TypeScript with `noUncheckedIndexedAccess`.

### Security
- API key only via env (`UNIFI_API_KEY`). Never logged.
- Logger redacts known secret patterns.
