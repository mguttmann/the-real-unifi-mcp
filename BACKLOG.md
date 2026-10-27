# Backlog

Open minor items: no known bug that affects users today, but worth doing. Each change in an area reads the open items of that area first and takes them along. Remove an item in the change that fixes it, together with the test that holds it, and name it in `CHANGELOG.md`.

The ids (N-...) come from a code audit of 2026-10-27; code comments that name an id (for example "audit N-2") point to the item that the code fixed. Closed items are summarised in `CHANGELOG.md` 0.2.0, 0.2.1 and 0.3.0.

"Contract" marks items whose fix changes the tool contract (`tests/contract/tools-contract.json`) and therefore needs a "Behaviour changes for callers" entry.

## Tools and client

- **N-46** `npm test` includes the live smoke in `tests/integration/`, which calls api.ui.com when `UNIFI_API_KEY` is exported and asserts counts of one specific network. Fix: exclude it from `npm test`, opt in with `UNIFI_LIVE=1`, assert shapes only.
- **N-48** Dead code: the trailing throw in `src/client/retry.ts`, `Discovery.reset()`.
- **N-80** One stdio message above the SDK line limit closes the transport and the process exits with code 0 and no log line (`src/index.ts`). Fix: log the transport close at `error` and exit non-zero.
- **N-94** The SDK stdio transport prints `MaxListenersExceededWarning` on stderr at about 30 parallel calls; log noise only, upstream.

## Build, CI and release

- **N-16, N-61** Tests, `scripts/smoke-stdio.mjs` and `tests/contract/liveTools.ts` are not type-checked (`tsc` covers `src/` only) and ESLint runs on `src/` without type information. Fix: a tests tsconfig and type-aware ESLint in CI.
- **N-19** `npm run build` runs lint and unit tests through `prebuild`, so every source build needs the dev dependencies. Fix: a separate `check` script for CI and a plain `tsc` build, coordinated with downstream consumers that build from source.
- **N-53** No secret scan in CI. Fix: a gitleaks job over the full history.
- **N-62** The "body stays optional at call time" block in `tests/unit/contract.test.ts` is covered by `tests/unit/bodyOptional.test.ts`; drop it with the next change in that file.
- **N-67** The vendor-path check in `tests/unit/network.handlers.test.ts` matches path templates by shape, so a literal segment in an id slot passes. Fix: compare literal segments against the fixture template.
- **N-72** The CI floor job runs Node 22.12.0 with its bundled npm; `npm ci` with that npm is proven only by CI runs.
- **N-74** The CycloneDX SBOMs carry npm's timestamp and a random serial number, so they and `SHA256SUMS` differ between two builds of the same commit; only the `.mcpb` is byte-reproducible (`scripts/build-mcpb.sh`). Fix: timestamp from `SOURCE_DATE_EPOCH`, serial from a content hash.
- **N-75** `mcpb validate` runs the MCPB CLI through `npx`, whose dependencies resolve unlocked at build time. Fix: pin `@anthropic-ai/mcpb` as a devDependency or validate against the vendored JSON schema.
- **N-76** The release `build` job runs `npm ci` with install scripts enabled. Fix: `--ignore-scripts` where the build allows it.
- **N-77 (rest)** The `files` list of `package.json` is checked by `npm pack --dry-run` by hand only. Fix: a test over `npm pack --dry-run --json`.
- **eslint 9 deprecated** npm marks `eslint@9.39.5` as no longer supported (seen during the 0.3.0 dependency update); `eslint` 10, `@eslint/js` 10, `globals` 17, `typescript` 7 and `@types/node` above 22 are majors outside the declared ranges. Fix: move the lint toolchain to eslint 10 in a separate change and keep `@types/node` on the Node floor line.
- **N-97** The MCP Registry entry (`server.json`) lists only the npm package. Fix: add the `.mcpb` release asset as a second package (the registry workflow then fills its URL and SHA-256 from the release).
