# Backlog

Open minor items: no known bug that affects users today, but worth doing. Each change in an area reads the open items of that area first and takes them along. Remove an item in the change that fixes it, together with the test that holds it, and name it in `CHANGELOG.md`.

The ids (N-...) come from a code audit of 2026-10-27; code comments that name an id (for example "audit N-2") point to the item that the code fixed. Closed items are summarised in `CHANGELOG.md` 0.2.0, 0.2.1 and 0.3.0.

"Contract" marks items whose fix changes the tool contract (`tests/contract/tools-contract.json`) and therefore needs a "Behaviour changes for callers" entry.

Every item of the 2026-10-27 audit is closed in 0.3.0 or dropped with the reason in `CHANGELOG.md` 0.3.0. What remains is held by something outside this repository, plus the minors of the 0.3.0 review at the end.

## Build, CI and release

- **eslint 10 (blocked by the Node floor)** npm marks `eslint@9.39.5`, the last 9.x, as no longer supported. Every `eslint` 10 release (and `@eslint/js` 10) requires Node `^20.19.0 || ^22.13.0 || >=24`, while this package supports Node 22.12 (`engines`, CI job `build (node 22.12.0)`) and `prebuild` runs the linter in every source build of a consumer. Moving to eslint 10 therefore means raising the Node floor to 22.13, a change for downstream consumers that the owner decides. Then: `eslint` and `@eslint/js` 10, `globals` 17, and keep `@types/node` on the Node floor line; `typescript` 7 waits for `typescript-eslint` (its peer range ends below 6.1).

## Minors from the 0.3.0 review

- **Node 23 and 25 not gated** `engines` allows `>=22.12`, while `vitest` 5 declares `^22.12.0 || ^24.0.0 || >=26.0.0`. On Node 23 and 25 (no LTS lines) `npm ci` only warns, and whether `prebuild` passes there is not checked. Either narrow `engines` to the tested lines (a change for consumers, owner decides) or add a CI job.
- **`tools/list` size** grew from about 76 KB to about 276 KB in 0.3.0; `unifi_gen_createfirewallpolicy` and `unifi_gen_updatefirewallpolicy` carry about 55 KB each through the vendor request schema of `body`. The CHANGELOG names the growth; a slimmer reference schema would help gateways with a per-tool size limit.
- **MCPB placeholders fail closed** If an MCPB host does not substitute `${user_config.read_only}` in `mcpb/manifest.json`, the unknown value turns read-only on and every write tool refuses. The same pattern exists for `confirm_writes` and `log_level`; worth a note in the README MCPB section if a host shows this.
