# CLAUDE.md

Rules for coding agents in this repository. Human contributors: see CONTRIBUTING.md.

## Commands

```bash
npm ci                    # install from the lockfile
npm run lint              # ESLint with type information (src, tests, scripts)
npm run typecheck         # tsc --noEmit over src, then tests and scripts (tsconfig.tests.json)
npm run format:check      # Prettier (src, tests; CI gate)
npm run test:unit         # unit tests, offline
npm run build             # prebuild runs lint + typecheck + unit tests, then tsc
node scripts/smoke-stdio.mjs   # after a build: lists the tools of dist/ over stdio
```

`npm test` is offline. `npm run test:integration` calls api.ui.com when `UNIFI_LIVE=1` and `UNIFI_API_KEY` are set; never set `UNIFI_LIVE` unless the owner asks for it.

## No live API calls

- Never call a UniFi console or api.ui.com, and never run `npm run codegen` (it downloads the vendor OpenAPI documents from developer.ui.com into `tests/fixtures/openapi/` and rewrites `src/tools/generated/`) unless the owner asks for it. `npm run codegen -- --offline` regenerates from the committed documents without network and is always allowed.
- Every server you start (smoke, inspector, probes) gets a dummy key and `UNIFI_API_BASE=http://127.0.0.1:1`.
- Tests stub `fetch`; never run write tools against a real network.

## Tool contract

The tool names, count, required params, property names, defaults and annotations are a hard contract for MCP gateways that call this server. `tests/unit/contract.test.ts` compares `tools/list` with `tests/contract/tools-contract.json`.

- A deliberate contract change means editing the snapshot by hand and listing it in `CHANGELOG.md` under "Behaviour changes for callers".
- Description or schema-byte changes are reported, not failed: list them in the CHANGELOG, then accept with `UPDATE_CONTRACT_NOISE=1 npx vitest run tests/unit/contract.test.ts`.
- `tests/unit/contractCompat.test.ts` compares `tools/list` with the frozen 0.2.1 tool list `tests/contract/tools-contract-0.2.1.json`; never regenerate that file. Existing params may only widen, and added params must accept any value.
- Read tools keep their name prefixes (`unifi_sm_*`, `unifi_net_get_*`, `unifi_net_list_*`, `unifi_gen_get*`, `unifi_gen_list*`); MCP gateways may grant read access by these patterns.

## Downstream consumers

MCP gateways and other consumers may pin a commit of this repository, build it with `npm ci && npm run build` and start it as `node dist/index.js` (optionally with `--env-file=.env`). Keep both commands working on the supported Node lines: `prebuild` (lint, typecheck, unit tests) runs as part of `npm run build`, so a red lint or test fails their build. New environment variables must be optional with a safe default and documented in `.env.example`, `server.json` and the README.

## Docs

When a fact changes (count, default, version, env var, behaviour), update every place that states it: README, CHANGELOG, SECURITY.md, CONTRIBUTING.md, BACKLOG.md, `.env.example`, `mcpb/manifest.json`, `server.json`, the server instructions in `src/server.ts` and `docs/`. `tests/unit/docs.test.ts` holds the defaults, counts and limits the docs name. No em or en dashes.
