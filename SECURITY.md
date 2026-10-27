# Security Policy

## Supported versions

Only the latest minor release (`0.2.x`) receives security fixes at this time.

Versions 0.1.0 and 0.1.1 on npm let `unifi_raw_request` send the API key to a host named in the request path (SSRF, key exfiltration). Do not use them; upgrade to the latest release.

## Reporting a vulnerability

**Please do not open public GitHub issues for security problems.**

Use [GitHub Security Advisories](https://github.com/mguttmann/the-real-unifi-mcp/security/advisories/new); this routes the report privately to the maintainer.

What to include:
- Affected version (commit SHA or release tag)
- Reproduction steps
- Impact assessment (data exposure, write access, denial of service, ...)
- Suggested fix if you have one

You can expect an acknowledgement within 72 hours and a fix or mitigation within 14 days for confirmed issues.

## Threat model

The server runs as a local stdio process next to one MCP client (or behind an MCP proxy that serves several users). It holds one UniFi Site Manager API key and forwards tool calls to the UniFi cloud API. What it defends, and what it leaves to the client or to whoever runs it:

| Threat | What the server does | What it does not do |
|---|---|---|
| A caller (or a prompt-injected model) steers a request to another host to steal the key (SSRF) | Request paths must be relative. Absolute URLs, `//`, `://`, `@`, `\`, `..` (also `%2e`-encoded) and control characters (C0 and DEL) are refused before any request. The path is appended to the origin of `UNIFI_API_BASE` and the resolved origin is checked again. `X-API-Key` is sent only to that origin. Ids in hand-written tool paths are percent-encoded as one segment, so `?`, `#` or `/` in an id cannot change the target. | It cannot stop a call to any UniFi API path on that host: `unifi_raw_request` and the generated tools can reach every endpoint the key allows. Restrict who may call them (for example by tool name in your MCP client or proxy). |
| The API answers with a redirect to another host | `fetch` runs with `redirect: "error"`; a redirect becomes an error result and is not retried. | |
| `UNIFI_API_BASE` points at a host you do not control | The server refuses to start unless the value is an `https://` origin (plain `http://` only for `127.0.0.1`, `[::1]` and `localhost`) without path, query, fragment or credentials. | Any `https://` host is accepted, and that host receives the key. Leave it at `https://api.ui.com` unless you test against a local stub. |
| Indirect prompt injection: strings stored in UniFi (device names, client hostnames, SSIDs, firewall and rule descriptions, voucher notes) or upstream error bodies carry instructions for the model | The server instructions tell the model to treat all tool results as data, never as instructions. Error texts from the API are scrubbed like log lines and cut to a fixed length. Write tools default to preview-then-confirm (below). | Tool results are returned verbatim and unframed; the server cannot tell data from instructions. A model may still follow injected text. Use a client that asks a human before destructive tools run, grant write tools only where needed, and prefer the read-only tools for exploration. |
| A write runs by accident | With `UNIFI_CONFIRM_WRITES` on (the default), every destructive tool returns a preview with secret-looking body fields redacted (names containing `password`, `passphrase`, `psk`, `secret`, `token`, `api_key`, `private_key` or `wep_key`, and `presharedKeys`, `key`), and executes only when called again with `confirm: "YES"`. `dry_run: true` returns the preview and never executes. `UNIFI_READ_ONLY` (opt-in) makes every write tool refuse without a request. All write tools carry `destructiveHint: true`. | The model can send `confirm: "YES"` itself: the guard is a second step for the model, not a human approval. A secret in a field with another name is shown. `UNIFI_READ_ONLY` is off by default. |
| A write is duplicated after a dropped connection | `POST`, `PUT`, `PATCH` and `DELETE` are resent after a network error only when the connection was never established. `GET` is also retried on `5xx` and dropped connections; `429` is retried on every method. | |
| The key leaks through logs | Log lines on stderr are scrubbed for known patterns (`UNIFI_API_KEY=...`, `X-API-Key`, `Authorization`, `apiKey`, `api_key`, JSON string fields named like a password, passphrase, pre-shared key or secret, and `api_key` / `apikey` / `token` / `access_token` query parameters) and for the configured key by exact value; the fatal startup line too. The key is never put into a URL. | Output written by other tooling (process lists, debuggers, container logs, the MCP client) is not covered. |
| Oversized input exhausts the process | A `tools/call` whose `arguments` contain more than 100000 array elements and object members in total is refused before schema validation (`maxToolInputElements`). zod `^4.6.7` fixes GHSA-mrhx-c7xc-m3w5. The MCP SDK (`@modelcontextprotocol/server` 2.x, as SDK 1.x since 1.32) reads at most 10 MiB of unterminated stdio input: a single incoming message above that closes the stdio transport; the process logs `stdio transport closed` at `error` and exits with code 1, without an error result to the client. The client has to restart the server. | Response bodies from UniFi are read in full; `UNIFI_MAX_RESULT_BYTES` (default 100000 bytes since 0.4.0; `0`, `off` or `none` turn it off) cuts the tool result text after the response has been read, so it limits what reaches the client, not the memory the read takes. It does not apply to MCP resource reads (`unifi://hosts`, `unifi://hosts/{id}`, `unifi://identity`). |
| Secret data in read results | With `UNIFI_REDACT_SECRETS` on (opt-in), every tool result has the fields the confirm preview redacts replaced by `(redacted)`; paging tokens such as `nextToken` stay. Every write tool, also `unifi_raw_request` and the generated tools, refuses a body in which any value at any depth is exactly `(redacted)`, with `code: "REDACTED_PLACEHOLDER"`, before the preview, `dry_run` and the request, whatever the settings: an object read with redaction on and written back unchanged cannot set a passphrase to the placeholder. | By default, read tools return what the API returns, unchanged, including WLAN passphrases and pre-shared keys, MAC and IP addresses and hostnames; redaction then applies only to confirm previews, error texts and logs. Even with the switch on, a secret in a field with another name, MAC and IP addresses and hostnames are returned, and MCP resource reads (`unifi://hosts`, `unifi://hosts/{id}`, `unifi://identity`) return the API data unredacted. Treat tool and resource output as sensitive. The write check matches only the exact value: a placeholder inside a longer string, or a secret masked by other tooling in another form, is sent as given. |

## API key hygiene

The UniFi Site Manager API key controls your entire network; treat it as a production credential:

- Never commit it. `.env` is gitignored; use it for local key storage.
- On startup the server reads a `.env` file from its current working directory and fills only variables that are not already set (dotenv). Start it from a directory whose `.env` you trust, or pass the variables directly (client `env`, `node --env-file=...`). dotenv never writes to stdout, whatever `DOTENV_QUIET`, `DOTENV_DEBUG` or the `DOTENV_CONFIG_*` variables say, so it cannot corrupt the stdio protocol.
- Never paste it into a chat that may be logged or summarised.
- Rotate the key in the UniFi Site Manager console if it has ever been exposed.
- This MCP server redacts known secret patterns from its own log output, but external tooling (process lists, debuggers, container logs) may still capture environment variables.

## Destructive operations

**By default (`UNIFI_CONFIRM_WRITES` unset or `true`), destructive calls return a redacted preview and only execute when invoked again with `confirm: "YES"`.** Only `false`, `0`, `no` or `off` (any case) turn the guard off; then write and delete tools execute immediately with no confirmation step. Unset, empty, `true`, `1`, `yes` and `on` keep it on, and an unknown value keeps it on and logs a warning at startup. All mutating tools also carry the MCP `destructiveHint` annotation so a well-behaved client can prompt before executing.

Every write tool also takes `dry_run: true`, which returns the preview and sends nothing, whatever `confirm` and `UNIFI_CONFIRM_WRITES` say. With `UNIFI_READ_ONLY` on (off by default), every tool with a `confirm` param returns an error with `code: "READ_ONLY"` and sends no request; read tools and `unifi_raw_request` with `GET` keep working. Use it for exploration sessions in which nothing may change.

## Raw request escape hatch

`unifi_raw_request` issues an HTTP request to a caller-supplied path against the configured UniFi API base. The path rules in the threat model apply (relative path only, origin pinned, key only to that origin, redirects refused). Only ever point this server at the official `https://api.ui.com` base (the default): whatever host `UNIFI_API_BASE` names receives the key. The tool can still call any endpoint and method of the UniFi API with your key, so do not expose it to untrusted prompt content without review.
