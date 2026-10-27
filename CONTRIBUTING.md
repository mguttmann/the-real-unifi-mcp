# Contributing

Thanks for your interest in this project. Issues, ideas and pull requests are welcome.

## Development setup

```bash
git clone https://github.com/mguttmann/the-real-unifi-mcp.git
cd the-real-unifi-mcp
npm ci
cp .env.example .env
# Set UNIFI_API_KEY (Site Manager API key with Network scope)
npm run build
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Watch-mode build via tsx |
| `npm run build` | Compile to `dist/` via `tsc`. The `prebuild` hook runs lint + typecheck + unit tests first (npm runs it automatically). |
| `npm run test:unit` | Unit tests (offline; what `prebuild` runs) |
| `npm test` | Unit tests plus the live smoke in `tests/integration/`, which calls api.ui.com when `UNIFI_API_KEY` is set (unset it to stay offline) |
| `npm run test:integration` | Live read-only smoke (needs UNIFI_API_KEY) |
| `npm run test:stdio` | Starts the built `dist/index.js` over stdio (dummy key, unreachable API base) and checks every supported MCP protocol revision and that loading `.env` writes nothing to stdout; run after `npm run build` |
| `npm run codegen` | Regenerate `src/tools/generated/` from the live UniFi docs (see "Auto-generated tool" below) |
| `npm run inspector` | Launch MCP Inspector |
| `npm run build:mcpb` | Build the MCPB bundle and SBOMs into `release/` (validates the manifest; releases: [docs/RELEASING.md](./docs/RELEASING.md)) |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier over `src/` and `tests/` (CI runs `format:check`) |
| `npm run typecheck` | tsc --noEmit |

## Workflow

1. Fork + branch from `main` (`feature/foo`, `fix/bar`, `docs/baz`).
2. Make changes with tests where applicable.
3. Run `npm run prebuild` (lint, typecheck, unit tests); it must be green. CI also runs `npm run format:check`, `npm run build`, `npm audit --omit=dev --audit-level=high` and the stdio smoke on every supported Node line.
4. Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
5. Open a PR using the template.

## Adding a tool

### Hand-wrapper (preferred for common operations)
1. Pick or create `src/tools/network/<resource>.ts`.
2. Follow the existing pattern (`netGet` / `netWrite` helpers, annotation constants).
3. Add registration in `src/server.ts`.
4. Add a smoke test in `tests/unit/network.<resource>.test.ts`.

### Auto-generated tool
1. Add the doc page name to `src/codegen/catalog.ts`.
2. Run `npm run codegen`. It deletes `src/tools/generated/` first and then fetches every catalog page from developer.ui.com; a page that fails to fetch or parse is dropped from the output (the catalog entries `gethost` and `getsdwanconfig` are known to fail). Review the whole diff, restore any dropped tool and run the contract test before committing.
3. Commit the generated `.ts` file together with the catalog change.

## Code style

- TypeScript strict, including `noUncheckedIndexedAccess`.
- ES modules (`import`, no `require`).
- Comments only where the WHY is non-obvious.
- No `console.log`; use the stderr-safe `logger` (stdout is reserved for stdio JSON-RPC).
- API key never logged. Logger redaction patterns live in `src/utils/logger.ts`.

## Testing

Unit tests use vitest with mocked `fetch` and never reach the network. Integration tests are skipped when `UNIFI_API_KEY` is absent; never run them in CI. Any server you start for a test gets a dummy key and `UNIFI_API_BASE=http://127.0.0.1:1`.

The tool contract is pinned by `tests/unit/contract.test.ts` against `tests/contract/tools-contract.json` (names, count, required params, property names, defaults, annotations). Adding, renaming or removing a tool, or changing a required param, default or annotation, means editing the snapshot by hand and listing the change in `CHANGELOG.md` under "Behaviour changes for callers". Description or other schema-byte changes are only reported; accept them with `UPDATE_CONTRACT_NOISE=1 npx vitest run tests/unit/contract.test.ts`. `node scripts/smoke-stdio.mjs` (after `npx tsc`) lists the tools of the built server over stdio.

When adding a destructive tool, write a registration smoke test. Don't run write operations against a live network in tests.

## Security

If you find a vulnerability, please use [GitHub Security Advisories](https://github.com/mguttmann/the-real-unifi-mcp/security/advisories/new) rather than opening a public issue. See [SECURITY.md](./SECURITY.md) for the full policy and disclosure timeline.
