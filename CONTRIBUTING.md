# Contributing

Thanks for your interest in this project. Issues, ideas and pull requests are welcome.

## Development setup

```bash
git clone https://github.com/mguttmann/the-real-unifi-mcp.git
cd the-real-unifi-mcp
npm install
cp .env.example .env
# Set UNIFI_API_KEY (Site Manager API key with Network scope)
npm run build
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Watch-mode build via tsx |
| `npm run build` | Full build (lint + typecheck + unit tests + tsc) |
| `npm test` | Unit tests |
| `npm run test:integration` | Live read-only smoke (needs UNIFI_API_KEY) |
| `npm run codegen` | Regenerate `src/tools/generated/` from UniFi docs |
| `npm run inspector` | Launch MCP Inspector |
| `npm run build:mcpb` | Build MCPB bundle artifact |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run typecheck` | tsc --noEmit |

## Workflow

1. Fork + branch from `main` (`feature/foo`, `fix/bar`, `docs/baz`).
2. Make changes with tests where applicable.
3. Run `npm run prebuild` — must be green.
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
2. Run `npm run codegen`.
3. Commit the generated `.ts` file together with the catalog change.

## Code style

- TypeScript strict, including `noUncheckedIndexedAccess`.
- ES modules (`import`, no `require`).
- Comments only where the WHY is non-obvious.
- No `console.log` — use the stderr-safe `logger` (stdout is reserved for stdio JSON-RPC).
- API key never logged. Logger redaction patterns live in `src/utils/logger.ts`.

## Testing

Unit tests use vitest with mocked `fetch`. Integration tests are skipped when `UNIFI_API_KEY` is absent — never run them in CI.

When adding a destructive tool, write a registration smoke test. Don't run write operations against a live network in tests.

## Security

If you find a vulnerability, please use [GitHub Security Advisories](https://github.com/mguttmann/the-real-unifi-mcp/security/advisories/new) rather than opening a public issue. See SECURITY.md.
