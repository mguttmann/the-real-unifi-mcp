# Backlog

Open minor items: no known bug that affects users today, but worth doing. Each change in an area reads the open items of that area first and takes them along. Remove an item in the change that fixes it, together with the test that holds it, and name it in `CHANGELOG.md`.

The ids (N-...) come from a code audit of 2026-10-27; code comments that name an id (for example "audit N-2") point to the item that the code fixed. Closed items are summarised in `CHANGELOG.md` 0.2.0, 0.2.1 and 0.3.0.

"Contract" marks items whose fix changes the tool contract (`tests/contract/tools-contract.json`) and therefore needs a "Behaviour changes for callers" entry.

Every item of the 2026-10-27 audit is closed in 0.3.0 or dropped with the reason in `CHANGELOG.md` 0.3.0. What remains is held by something outside this repository.

## Build, CI and release

- **eslint 10 (blocked by the Node floor)** npm marks `eslint@9.39.5`, the last 9.x, as no longer supported. Every `eslint` 10 release (and `@eslint/js` 10) requires Node `^20.19.0 || ^22.13.0 || >=24`, while this package supports Node 22.12 (`engines` `^22.12.0 || ^24.0.0 || >=26.0.0`, CI job `build (node 22.12.0)`) and `prebuild` runs the linter in every source build of a consumer. Moving to eslint 10 therefore means raising the Node floor to 22.13, a change for downstream consumers that the owner decides. Then: `eslint` and `@eslint/js` 10, `globals` 17, and keep `@types/node` on the Node floor line; `typescript` 7 waits for `typescript-eslint` (its peer range ends below 6.1).

## Release 0.3.0 follow-ups

- **`tools/list` size headroom** `tests/unit/toolsListSize.test.ts` caps the full list at 120,000 bytes; 0.4.0 is close to it (the `includeStatistics` params added a little). The next codegen update with new vendor fields may turn the test red. Then decide whether to raise the cap (and name it in the CHANGELOG) or compact further.
- **Body cancel on a locked stream** (0.3.1, found while adding the body-read abort tests): `readBody` in `src/client/unifiClient.ts` calls `res.body.cancel()` on abort, but `res.text()` holds the reader lock, so the call rejects ("ReadableStream is locked") and the stream is not cancelled; the promise still settles. Real fetch also aborts the body through the request signal. Only an undici release that ignores that signal would keep the connection open until the server closes it.
- **Voucher filter not checked for the placeholder** (0.3.1 review minor): `unifi_net_delete_vouchers` sends no body, only the `filter` query parameter, which it also takes from the legacy `body.filter`; a `filter` of exactly `(redacted)` is not refused by the `REDACTED_PLACEHOLDER` check. No secret is written (the filter only selects the vouchers to delete); check it with the next change to the hotspot tools if wanted.
- **Truncated results are no JSON** (0.4.0 review minor): with the default cap of 100000 bytes, a result above it ends with the plain-text truncation marker and no longer parses as JSON. This was already so in 0.3.0 with a cap set and is named in `CHANGELOG.md` 0.4.0; gateways that parse results now meet it without setting anything. If a consumer reports it, consider a JSON-shaped marker (a contract change for callers).
- **Truncation cuts the paging hint** (0.4.0 red team minor): the cut drops the end of the JSON text, so the `pagination` hint and the `nextToken` of a Site Manager list are lost, while the marker suggests `pageSize` and `nextToken`. Paging still works: the caller repeats the call with a smaller `pageSize` and gets the token from that result. A fix belongs with the JSON-shaped marker above (for example keep `nextToken` in the marker).
