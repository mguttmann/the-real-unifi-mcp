# Changelog

## [Unreleased]

### Added
- Publication-readiness polish: full README, GitHub community files (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue and PR templates).
- GitHub Actions CI (Node 20 and 22 matrix: lint, typecheck, unit tests).
- Dependabot for npm and GitHub Actions updates.
- `.editorconfig`, `.nvmrc`, and package.json metadata (repository, homepage, bugs, keywords, author).

### Removed
- Internal design documents (`docs/superpowers/`) — kept locally only.

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
