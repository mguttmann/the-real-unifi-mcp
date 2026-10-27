# Backlog

Open minor items: no known bug that affects users today, but worth doing. Each change in an area reads the open items of that area first and takes them along. Remove an item in the change that fixes it, together with the test that holds it, and name it in `CHANGELOG.md`.

The ids (N-...) come from a code audit of 2026-10-27; code comments that name an id (for example "audit N-2") point to the item that the code fixed. Closed items are summarised in `CHANGELOG.md` 0.2.0 and 0.2.1.

"Contract" marks items whose fix changes the tool contract (`tests/contract/tools-contract.json`) and therefore needs a "Behaviour changes for callers" entry.

## Planned for 0.3.0 (code generator and tool schemas)

- **N-36** The codegen catalog has two wrong Site Manager slugs (`gethost`, `getsdwanconfig`; the vendor pages are `gethostbyid`, `getsdwanconfigbyid`), so `npm run codegen` always exits 1. Fix: rename; a regeneration adds two tools. Contract: additive tools.
- **N-37** The code generator reads `requestBody.schema`, but the vendor docs nest it under `content["application/json"].schema`, so every generated `body` is `z.unknown()` and `requestBody.required` is ignored (`src/codegen/emit.ts`). Fix: read the nested schema, honour `required`, fixture-based emit test, planned rollout. Contract: yes (tightens the input schemas of the generated write tools).
- **N-38** The Network API docs moved to v11; the catalog is pinned to v10.3.58 (`src/codegen/catalog.ts`). v11 adds required WiFi fields. Fix: bump together with N-37 and review the schema diff. Contract: description change on all generated tools, possibly more.
- **N-39** Hand-written list tools omit pagination and filter params, so only the first page is reachable (`src/tools/network/acl.ts`, `dns.ts`, `trafficLists.ts`, `hotspot.ts`, `switching.ts`, `src/tools/siteManager.ts`). Fix: optional params. Contract: additive optional params.
- **N-40** `unifi_sm_get_isp_metrics` lacks the vendor `duration` param (24h, 7d, 30d). Fix: optional enum. Contract: additive.
- **N-45** Hand-written tool handlers are only partly covered: `tests/unit/network.handlers.test.ts` drives every `unifi_net_*` tool through the real client with a fake `fetch`, but asserts method, path, query and body only for some tools; the other CRUD tools are checked for the path only. Fix: table-driven cases for all of them.
- **N-26** The confirm preview of generated write tools omits query params (bulk filter, force); execution sends them (`src/codegen/emit.ts`). Fix: include the query in the preview URL and regenerate.
- **N-27** Annotation inaccuracies: `unifi_gen_queryispmetrics` is marked destructive (its twin `unifi_sm_query_isp_metrics` is read-only), creates are marked destructive, block is not idempotent. Fix: a codegen override list. Contract: annotations change.
- **N-43** An object-typed `filter` query value is serialised as `[object Object]` (`src/client/unifiClient.ts`, `String(v)`); v11 types the device tag filter as an object. Fix: force `z.string()` in codegen or JSON-encode.
- **N-44** The code generator deletes `src/tools/generated/` before fetching, so a page that fails to fetch silently drops its tool; only 3 of the catalog pages have fixtures. Fix: write to a temp dir and swap on full success; fixtures for all pages; drift check in CI.
- **N-63** `src/codegen/schemaFromDoc.ts`: an object property the vendor marks required is emitted without `.optional()`; with a `z.unknown()` schema, zod 4 rejects a missing key where zod 3 accepted it. No generated tool hits this today. Handle with N-37. Contract: yes when it applies.

## Tools and client

- **N-22 (rest)** Read tools return WiFi passphrases and pre-shared keys as the API returns them (documented in `SECURITY.md`). Possible opt-in masking of secrets in read results; changes output, so only behind a new optional variable.
- **N-23 (rest)** No read-only switch: an opt-in `UNIFI_READ_ONLY` that refuses write tools at call time (all tools stay registered), and handling of a `dry_run` argument, which is silently stripped today.
- **N-32** No response size cap: the full body goes pretty-printed into the tool result; Site Manager list tools have no paging hint. Fix: byte cap with a truncation marker.
- **N-35** MCP cancellation is not passed to `fetch`, and retry sleeps are not abortable (`src/client/unifiClient.ts`). Fix: thread the request signal, abortable sleep, remove the listener.
- **N-64** A caller-supplied `signal` abort is reported as a timeout (`code: TIMEOUT`). Fix: distinguish `options.signal?.aborted`. No caller passes a signal today.
- **N-41, N-79** The prompts reference fields the API does not return (WAN status, last seen, client activity, firewall creation time; `src/prompts/networkHealth.ts`, `auditFirewall.ts` has an unused `siteId` arg), and the README describes `unifi-network-health` with those fields. Fix: rewrite prompts and README line to the available fields.
- **N-42** Discovery matches hosts of type `console` only (`src/client/discovery.ts`); the vendor example also shows `ucore`. Fix: match an owned host with a Network controller, or document `UNIFI_CONSOLE_ID`.
- **N-46** `npm test` includes the live smoke in `tests/integration/`, which calls api.ui.com when `UNIFI_API_KEY` is exported and asserts counts of one specific network. Fix: exclude it from `npm test`, opt in with `UNIFI_LIVE=1`, assert shapes only.
- **N-47** Duplicate request helpers in the hand-written tool files (`netGet` in 10 files, `netWrite` in 7 with 3 variants). Fix: one shared module.
- **N-48** Dead code: the trailing throw in `src/client/retry.ts`, `Discovery.reset()`.
- **N-65** `unifi_net_port_action` spreads the caller `body` after the mapped action, so `body.action` overrides the vendor value (`src/tools/network/devices.ts`). Fix: spread `body` first, then `action`.
- **N-66** Confirm previews of hand-written write tools show the console id unencoded in the URL (display only; the request encodes it). Fix: build the preview URL with one helper.
- **N-80** One stdio message above the SDK line limit closes the transport and the process exits with code 0 and no log line (`src/index.ts`). Fix: log the transport close at `error` and exit non-zero.
- **N-86** Error details for the same network failure differ between tools (`unifi_sm_*` returns `details.code`, most `unifi_net_*` only `statusCode`). Fix: one error-mapping helper.
- **N-94** The SDK stdio transport prints `MaxListenersExceededWarning` on stderr at about 30 parallel calls; log noise only, upstream.

## Build, CI and release

- **N-16, N-61** Tests, `scripts/smoke-stdio.mjs` and `tests/contract/liveTools.ts` are not type-checked (`tsc` covers `src/` only) and ESLint runs on `src/` without type information. Fix: a tests tsconfig and type-aware ESLint in CI.
- **N-19** `npm run build` runs lint and unit tests through `prebuild`, so every source build needs the dev dependencies. Fix: a separate `check` script for CI and a plain `tsc` build, coordinated with downstream consumers that build from source.
- **N-53** No secret scan in CI. Fix: a gitleaks job over the full history.
- **N-58** `dotenv/config` loads `.env` from the current working directory and fills unset variables. Fix: drop dotenv and rely on `node --env-file`; behaviour change for users who rely on a `.env` in the working directory.
- **N-62** The "body stays optional at call time" block in `tests/unit/contract.test.ts` is covered by `tests/unit/bodyOptional.test.ts`; drop it with the next change in that file.
- **N-67** The vendor-path check in `tests/unit/network.handlers.test.ts` matches path templates by shape, so a literal segment in an id slot passes. Fix: compare literal segments against the fixture template.
- **N-72** The CI floor job runs Node 22.12.0 with its bundled npm; `npm ci` with that npm is proven only by CI runs.
- **N-74** The CycloneDX SBOMs carry npm's timestamp and a random serial number, so they and `SHA256SUMS` differ between two builds of the same commit; only the `.mcpb` is byte-reproducible (`scripts/build-mcpb.sh`). Fix: timestamp from `SOURCE_DATE_EPOCH`, serial from a content hash.
- **N-75** `mcpb validate` runs the MCPB CLI through `npx`, whose dependencies resolve unlocked at build time. Fix: pin `@anthropic-ai/mcpb` as a devDependency or validate against the vendored JSON schema.
- **N-76** The release `build` job runs `npm ci` with install scripts enabled. Fix: `--ignore-scripts` where the build allows it.
- **N-77 (rest)** The `files` list of `package.json` is checked by `npm pack --dry-run` by hand only. Fix: a test over `npm pack --dry-run --json`.
- **N-97** The MCP Registry entry (`server.json`) lists only the npm package. Fix: add the `.mcpb` release asset as a second package (the registry workflow then fills its URL and SHA-256 from the release).
