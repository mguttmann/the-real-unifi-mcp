# Backlog

Open minor items: no known bug that affects users today, but worth doing. Each change in an area reads the open items of that area first and takes them along. Remove an item in the change that fixes it, together with the test that holds it, and name it in `CHANGELOG.md`.

The ids (N-...) come from a code audit of 2026-10-27; code comments that name an id (for example "audit N-2") point to the item that the code fixed. Closed items are summarised in `CHANGELOG.md` 0.2.0, 0.2.1 and 0.3.0.

"Contract" marks items whose fix changes the tool contract (`tests/contract/tools-contract.json`) and therefore needs a "Behaviour changes for callers" entry.

## Tools and client

- **N-94** The SDK stdio transport prints `MaxListenersExceededWarning` on stderr at about 30 parallel calls; log noise only, upstream.

## Build, CI and release

- **N-16, N-61** Tests, `scripts/smoke-stdio.mjs` and `tests/contract/liveTools.ts` are not type-checked (`tsc` covers `src/` only) and ESLint runs on `src/` without type information. Fix: a tests tsconfig and type-aware ESLint in CI.
- **N-19** `npm run build` runs lint and unit tests through `prebuild`, so every source build needs the dev dependencies. Fix: a separate `check` script for CI and a plain `tsc` build, coordinated with downstream consumers that build from source.
- **N-53** No secret scan in CI. Fix: a gitleaks job over the full history.
- **N-72** The CI floor job runs Node 22.12.0 with its bundled npm; `npm ci` with that npm is proven only by CI runs.
- **N-74** The CycloneDX SBOMs carry npm's timestamp and a random serial number, so they and `SHA256SUMS` differ between two builds of the same commit; only the `.mcpb` is byte-reproducible (`scripts/build-mcpb.sh`). Fix: timestamp from `SOURCE_DATE_EPOCH`, serial from a content hash.
- **N-75** `mcpb validate` runs the MCPB CLI through `npx`, whose dependencies resolve unlocked at build time. Fix: pin `@anthropic-ai/mcpb` as a devDependency or validate against the vendored JSON schema.
- **N-76** The release `build` job runs `npm ci` with install scripts enabled. Fix: `--ignore-scripts` where the build allows it.
- **N-77 (rest)** The `files` list of `package.json` is checked by `npm pack --dry-run` by hand only. Fix: a test over `npm pack --dry-run --json`.
- **eslint 9 deprecated** npm marks `eslint@9.39.5` as no longer supported (seen during the 0.3.0 dependency update); `eslint` 10, `@eslint/js` 10, `globals` 17, `typescript` 7 and `@types/node` above 22 are majors outside the declared ranges. Fix: move the lint toolchain to eslint 10 in a separate change and keep `@types/node` on the Node floor line.
- **N-97** The MCP Registry entry (`server.json`) lists only the npm package. Fix: add the `.mcpb` release asset as a second package (the registry workflow then fills its URL and SHA-256 from the release).
