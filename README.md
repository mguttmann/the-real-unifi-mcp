# the-real-unifi-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-22.12%2B%20%7C%2024%20%7C%2026%2B-brightgreen)](https://nodejs.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-2.x-blue)](https://github.com/modelcontextprotocol/typescript-sdk)
[![CI](https://github.com/mguttmann/the-real-unifi-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/mguttmann/the-real-unifi-mcp/actions/workflows/ci.yml)

> An MCP server that gives Claude (or any MCP client) full read/write access to the UniFi Site Manager and Network APIs over the official cloud endpoint. Cloud-only, stdio transport.

**Unofficial project.** This server is not affiliated with or endorsed by Ubiquiti Inc. UniFi and Ubiquiti are trademarks of Ubiquiti Inc., used here only to name the API this software works with; see [NOTICE](./NOTICE).

Point it at a UniFi Site Manager API key and your MCP client can list consoles, inspect devices and clients, and manage networks, WiFi, firewall policies, and more, through 169 tools covering the documented API surface.

## Features

- **169 tools** across both UniFi APIs, read *and* write.
- **Three-layer tool design:** 86 hand-wrappers (10 Site Manager + 76 Network) + 82 auto-generated tools, one per documented endpoint + 1 raw-request escape hatch (86 + 82 + 1 = 169). The tool contract is pinned by `tests/contract/tools-contract.json`.
- **MCP resources** and **MCP prompts** for ready-made workflows.
- **Lazy ID discovery** (consoleId / Network siteId / Site Manager siteId), cached for the process lifetime.
- **Write guard on by default:** `UNIFI_CONFIRM_WRITES` (default `true`) turns destructive tools into preview-then-confirm; set it to `false` to execute writes directly. The model itself can send `confirm: "YES"`, so this is a speed bump, not a human approval (see [SECURITY.md](./SECURITY.md)).
- **Secret redaction** in the server's own stderr log lines (known key patterns and the configured API key by value).

## Requirements

- Node.js 22.12 or a later 22.x, 24.x, or 26 and newer (`engines`: `^22.12.0 || ^24.0.0 || >=26.0.0`, the range of the test toolchain vitest). Node 23 and 25 are not supported.
- UniFi Site Manager API key with Network scope. Create one at [unifi.ui.com](https://unifi.ui.com) under Settings → API.
- UniFi Console with firmware ≥ 5.0.3 (required by the Network API).

## Installation

### From npm (recommended)

No install step is needed: your MCP client starts the server with `npx`, which fetches the package from npm on first use.

```bash
npx -y the-real-unifi-mcp   # starts the server on stdio; needs UNIFI_API_KEY in the environment
```

Or install it globally and use the `the-real-unifi-mcp` command:

```bash
npm install -g the-real-unifi-mcp
```

Pin a version (`the-real-unifi-mcp@<version>`) if you want updates only when you change the config. Releases from v0.2.1 on are published to npm from GitHub Actions with provenance (v0.2.0 is a GitHub release only); `npm audit signatures` verifies it.

### From source

```bash
git clone https://github.com/mguttmann/the-real-unifi-mcp.git
cd the-real-unifi-mcp
npm ci
cp .env.example .env
# Edit .env: set UNIFI_API_KEY (Site Manager key with Network scope)
npm run build   # prebuild runs lint, typecheck and unit tests first
npm start       # node dist/index.js; reads .env from the current directory
```

### As MCPB bundle

```bash
npm ci
npm run build:mcpb
# Writes release/the-real-unifi-mcp-<version>.mcpb (install it in Claude Desktop) and its SBOM.
```

The bundle maps its settings (API key, confirm writes, read-only, hide secrets, log level) to the environment variables below as `${user_config.<key>}` placeholders. If a host starts the server without substituting them, a value that is still such a placeholder counts as unset: each switch keeps its default, the missing key stops the server, and a warning names the variable.

Releases from v0.2.0 on attach the `.mcpb`, the npm tarball, CycloneDX SBOMs and `SHA256SUMS`; see [docs/RELEASING.md](./docs/RELEASING.md).

## Configuration

| Variable | Default | Description |
|---|---|---|
| `UNIFI_API_KEY` | (required) | Site Manager API key with Network scope |
| `UNIFI_API_BASE` | `https://api.ui.com` | API base URL. This host receives the API key: leave it at the default unless you test against a local stub. Must be `https://` (plain `http://` only for `127.0.0.1`, `[::1]` or `localhost`) and an origin without path, query or fragment; anything else stops the server at startup. |
| `UNIFI_CONFIRM_WRITES` | `true` | If on, destructive tools require `confirm: "YES"`. Only `false`, `0`, `no` or `off` (any case) turn it off. Unset, empty, `true`, `1`, `yes` and `on` keep it on; an unknown value keeps it on and logs a warning. |
| `UNIFI_TIMEOUT_MS` | `30000` | Per-request timeout (ms), covering the response headers and the body |
| `UNIFI_LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `UNIFI_CONSOLE_ID` | (unset) | Override discovery (pin to a specific console; needed when the account owns several consoles or a host of another type) |
| `UNIFI_NETWORK_SITE_ID` | (unset) | Override discovery (pin to a specific Network site) |
| `UNIFI_SITE_MANAGER_SITE_ID` | (unset) | Override discovery (pin to a specific Site Manager site) |
| `UNIFI_READ_ONLY` | `false` | If on, every tool with a `confirm` param (all write tools, and `unifi_raw_request` for methods other than `GET`) returns an error with `code: "READ_ONLY"` and sends no request; the tools stay listed. Same values as `UNIFI_CONFIRM_WRITES`; an unknown value turns it on and logs a warning. |
| `UNIFI_REDACT_SECRETS` | `false` | If on, every tool result has the fields the confirm preview redacts (passwords, WiFi passphrases, pre-shared keys, secrets, tokens, keys) replaced by `(redacted)`; paging tokens such as `nextToken` stay. MCP resources (`unifi://hosts`, `unifi://identity`) are not redacted. Same values as `UNIFI_READ_ONLY`. |
| `UNIFI_MAX_RESULT_BYTES` | (unset) | If set (a positive integer), a tool result text longer than this many UTF-8 bytes is cut to it and ends with a `... (truncated: ...)` marker that names the paging params. MCP resources are not cut. Unset: no cap. Any other value stops the server at startup. |

## Claude Desktop config

Add to `claude_desktop_config.json` (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "unifi": {
      "command": "npx",
      "args": ["-y", "the-real-unifi-mcp"],
      "env": {
        "UNIFI_API_KEY": "<your Site Manager API key>"
      }
    }
  }
}
```

Any variable from [Configuration](#configuration) can go into `env`. With a source checkout, use `"command": "node"` and `"args": ["--env-file=/absolute/path/to/the-real-unifi-mcp/.env", "/absolute/path/to/the-real-unifi-mcp/dist/index.js"]` instead.

Restart Claude Desktop after editing the file. The server exposes its tools under the `unifi` prefix.

## Claude Code config

Register the server with the Claude Code CLI (`--scope user` makes it available in every project; the default scope, `local`, keeps it private to you in the current project):

```bash
claude mcp add --scope user unifi --env UNIFI_API_KEY="YOUR_SITE_MANAGER_API_KEY" -- npx -y the-real-unifi-mcp
```

From a source checkout:

```bash
claude mcp add --scope user unifi -- node \
  --env-file=/absolute/path/to/the-real-unifi-mcp/.env \
  /absolute/path/to/the-real-unifi-mcp/dist/index.js
```

`claude mcp list` shows whether it connects.

## Tool reference

### Site Manager hand-wrappers (10)

Account-level tools against `api.ui.com` directly:

- `unifi_sm_list_hosts`: list all UniFi consoles on the account (optional `pageSize`, `nextToken`)
- `unifi_sm_get_host`: detail for a single console
- `unifi_sm_list_sites`: account-level sites (optional `pageSize`, `nextToken`)
- `unifi_sm_list_devices`: account-level device list (optional `hostIds`, `time`, `pageSize`, `nextToken`)
- `unifi_sm_get_isp_metrics`: ISP metrics by bucket (5m/1h), for `beginTimestamp`/`endTimestamp` or a `duration` (24h, 7d, 30d)
- `unifi_sm_query_isp_metrics`: query ISP metrics with a time window
- `unifi_sm_list_sdwan_configs`: SD-WAN configurations
- `unifi_sm_get_sdwan_config`: single SD-WAN configuration
- `unifi_sm_get_sdwan_config_status`: status of an SD-WAN configuration
- `unifi_sm_identity`: resolved consoleId, networkSiteId, siteManagerSiteId

### Network hand-wrappers (76)

Per-console tools via the Cloud Connector proxy, grouped by resource. Every `unifi_net_list_*` tool takes optional `offset`, `limit` and `filter` (vendor filter syntax); a result with more items carries a `pagination` hint with the next offset.

- **Info / Sites (2):** `unifi_net_get_info`, `unifi_net_list_sites`
- **Devices (9):** `unifi_net_list_devices`, `unifi_net_get_device`, `unifi_net_get_device_stats`, `unifi_net_list_pending_devices`, `unifi_net_adopt_devices`, `unifi_net_device_action`, `unifi_net_reboot_device`, `unifi_net_port_action`, `unifi_net_remove_device`
- **Clients (5):** `unifi_net_list_clients`, `unifi_net_get_client`, `unifi_net_client_action`, `unifi_net_block_client`, `unifi_net_unblock_client` (block/unblock return a "not supported" error: the Network API has no such client action)
- **Networks (6):** `unifi_net_list_networks`, `unifi_net_get_network`, `unifi_net_get_network_references`, `unifi_net_create_network`, `unifi_net_update_network`, `unifi_net_delete_network`
- **WiFi broadcasts (5):** `unifi_net_list_wifi`, `unifi_net_get_wifi`, `unifi_net_create_wifi`, `unifi_net_update_wifi`, `unifi_net_delete_wifi`
- **Firewall (13):** `unifi_net_list_firewall_zones`, `unifi_net_get_firewall_zone`, `unifi_net_create_firewall_zone`, `unifi_net_update_firewall_zone`, `unifi_net_delete_firewall_zone`, `unifi_net_list_firewall_policies`, `unifi_net_get_firewall_policy`, `unifi_net_create_firewall_policy`, `unifi_net_update_firewall_policy`, `unifi_net_patch_firewall_policy`, `unifi_net_delete_firewall_policy`, `unifi_net_get_firewall_policy_ordering`, `unifi_net_reorder_firewall_policies`
- **ACL rules (7):** `unifi_net_list_acl_rules`, `unifi_net_get_acl_rule`, `unifi_net_create_acl_rule`, `unifi_net_update_acl_rule`, `unifi_net_delete_acl_rule`, `unifi_net_get_acl_rule_ordering`, `unifi_net_reorder_acl_rules`
- **DNS policies (5):** `unifi_net_list_dns_policies`, `unifi_net_get_dns_policy`, `unifi_net_create_dns_policy`, `unifi_net_update_dns_policy`, `unifi_net_delete_dns_policy`
- **Traffic matching lists (5):** `unifi_net_list_traffic_lists`, `unifi_net_get_traffic_list`, `unifi_net_create_traffic_list`, `unifi_net_update_traffic_list`, `unifi_net_delete_traffic_list`
- **Hotspot vouchers (5):** `unifi_net_list_vouchers`, `unifi_net_get_voucher`, `unifi_net_create_vouchers`, `unifi_net_delete_voucher`, `unifi_net_delete_vouchers`
- **Switching (6):** `unifi_net_list_switch_stacks`, `unifi_net_get_switch_stack`, `unifi_net_list_mclag_domains`, `unifi_net_get_mclag_domain`, `unifi_net_list_lags`, `unifi_net_get_lag`
- **Supporting (8):** `unifi_net_list_wans`, `unifi_net_list_site_to_site_vpn`, `unifi_net_list_vpn_servers`, `unifi_net_list_radius_profiles`, `unifi_net_list_device_tags`, `unifi_net_list_dpi_application_categories`, `unifi_net_list_dpi_applications`, `unifi_net_list_countries`

### Auto-generated tools (82)

Named `unifi_gen_<operationid>` (the vendor operationId in lower case, e.g. `unifi_gen_createfirewallpolicy`, `unifi_gen_getinfo`). One tool per documented UniFi API endpoint (Site Manager API v1.0.0, Network API v11.0.97), except the Site Manager `connector*` proxy endpoints, which `unifi_raw_request` covers. siteId is auto-resolved from discovery; callers do not need to pass it. Write tools document the vendor request body in their `body` schema, but accept and send any `body` value unchanged, as in 0.2.1. See `src/tools/generated/` for the full inventory.

### Escape hatch (1)

`unifi_raw_request(method, path, body?, query?)`: execute any HTTP method against `api.ui.com{path}`. The path must be relative; see [SECURITY.md](./SECURITY.md) for what is refused. Auth, retry, error parsing, and pagination hints are handled automatically. Useful when no dedicated tool exists.

### Errors

A failed call returns an error result whose `details` carry the HTTP `statusCode` (0 when no response arrived) and, when known, a `code`: the code from the UniFi API, or `NETWORK_ERROR`, `REDIRECT_REFUSED`, `TIMEOUT` or `CANCELLED` (the client cancelled the call).

## Resources

- `unifi://identity`: resolved consoleId + both siteIds + console metadata
- `unifi://hosts`: account hosts list
- `unifi://hosts/{id}`: single host detail

## Prompts

- `unifi-audit-firewall`: walks firewall zones and policies, flags weak rules, suggests hardening
- `unifi-network-health`: configured WANs, device counts per state and pending firmware updates, connected clients by type and the most recently connected
- `unifi-adoption-status`: pending adoptions report with adopt/reject recommendation

## Write safety

By default (`UNIFI_CONFIRM_WRITES` unset or `true`), destructive tools require an explicit `confirm: "YES"` argument; without it they return a preview in which passwords, WiFi passphrases, pre-shared keys, secrets, tokens and keys in the body are replaced by `(redacted)`. Set `UNIFI_CONFIRM_WRITES=false` to let destructive tools execute directly:

```json
{
  "data": {
    "preview": {
      "tool": "unifi_net_create_vouchers",
      "method": "POST",
      "url": "/v1/connector/consoles/.../proxy/network/integration/v1/sites/.../hotspot/vouchers",
      "body": { "count": 1, "name": "demo" }
    },
    "hint": "Write confirmation is on (UNIFI_CONFIRM_WRITES). Re-run with `confirm: \"YES\"` to apply this change."
  }
}
```

Every write tool also takes `dry_run: true`: it returns the same preview and never executes, also with `confirm: "YES"` or with `UNIFI_CONFIRM_WRITES=false`. With `UNIFI_READ_ONLY=true`, write tools refuse with `code: "READ_ONLY"` and send nothing; read tools keep working.

The model can send `confirm: "YES"` on its own, so the guard is a second step for the model, not a human approval. If you want to approve each write yourself, keep your MCP client's per-tool approval on for the write tools (all of them carry `destructiveHint: true`).

## Examples

Prompts you can paste into Claude after installing the server:

- "Show me all my UniFi networks and their VLAN IDs."
- "Which of my UniFi devices are offline right now?"
- "Audit my firewall posture: group rules by zone and flag any allow-any-any."
- "Reboot the access point named `AP-Office-1`."
- "Power-cycle PoE port 3 on the switch named `SW-Office`."

Destructive examples respect `UNIFI_CONFIRM_WRITES` (default `true`): the model first gets a preview and has to call again with `confirm: "YES"` to apply.

## Limitations

- **Cloud-only.** All requests go through the UniFi cloud endpoint (`api.ui.com`) via the Site Manager API and the Network Cloud Connector proxy. There is no direct-to-controller / local-network mode.
- **Single account, owned consoles.** Discovery resolves consoles your API key owns. Multi-console and multi-site accounts must pin IDs via the `UNIFI_*_ID` variables (see [Troubleshooting](#troubleshooting)).
- **Auto-generated tools track the published docs.** The `unifi_gen_*` tools are generated from UniFi's documented endpoints; their input schemas are only as accurate as the upstream documentation. Use `unifi_raw_request` if an endpoint behaves differently than its schema suggests.
- **Network API requires recent firmware.** The Network API is only available on consoles running firmware ≥ 5.0.3.
- **No event streaming / websockets.** Tools are request/response only; there is no live event subscription.

## Troubleshooting

**"Discovery: no console found …"**
Discovery takes the host of type `console` that your key owns; only when there is none, an owned host of type `ucore` (UniFi OS Server). If your console has another type, or the key owns none, set `UNIFI_CONSOLE_ID=<id>` (the `id` from `unifi_sm_list_hosts`).

**"Discovery: multiple consoles match …"**
Your Site Manager account has more than one UniFi console. Set `UNIFI_CONSOLE_ID=<id>` from one of the listed IDs. The same pattern applies to multi-Network-site (`UNIFI_NETWORK_SITE_ID`) and multi-Site-Manager-site (`UNIFI_SITE_MANAGER_SITE_ID`) cases.

**`401 Unauthorized`**
The API key is missing the Network scope or has been revoked. Re-generate the key at [unifi.ui.com](https://unifi.ui.com) with both `Site Manager` and `UniFi Applications → Network` scopes enabled. Rotate any key that has ever been exposed in a chat or commit.

**Tools not showing in Claude Desktop**
Restart Claude Desktop after editing `claude_desktop_config.json`; config changes are only picked up on startup. The MCP log is at `~/Library/Logs/Claude/mcp-server-unifi.log` (macOS); check it for startup errors or discovery failures.

**Server stops right after a very large request**
The MCP SDK closes the stdio transport when one incoming message exceeds its line limit (see [SECURITY.md](./SECURITY.md)); the process then logs `stdio transport closed` on stderr and exits with code 1, without an error result. Split the input (for example fewer MACs or a smaller body per call) and restart the server.

## Development

```bash
npm run dev                  # tsx watch
npm run test:unit            # unit tests (offline; what prebuild runs)
npm test                     # unit tests (offline; the live smoke is not part of it)
npm run test:integration     # live read-only smoke against api.ui.com (only with UNIFI_LIVE=1 and UNIFI_API_KEY)
npm run codegen              # download the vendor OpenAPI docs and regenerate src/tools/generated/ (see CONTRIBUTING.md first)
npm run inspector            # MCP Inspector
npm run build:mcpb           # build MCPB bundle + SBOMs into release/
npm run lint                 # ESLint (type-aware, src, tests, scripts)
npm run typecheck            # tsc --noEmit (src), then tsconfig.tests.json (tests, scripts)
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

## Architecture

**Three-layer tool design.** Hand-wrappers (`unifi_sm_*`, `unifi_net_*`) provide ergonomic, well-documented entry points for common operations with auto-resolved IDs and named arguments. The 82 auto-generated tools (`unifi_gen_*`) cover the endpoints listed in the codegen catalog (`src/codegen/catalog.ts`), with input schemas derived from the upstream UniFi docs. `unifi_raw_request` is the escape hatch for anything not covered by the first two layers.

**Lazy ID discovery.** On first use, the server calls `GET /v1/hosts` to find the owned console (type `console`, or `ucore` when no console matches), then `GET /v1/sites` (Network and Site Manager) to discover both siteIds. Results are cached for the process lifetime. Concurrent callers share a single in-flight request via stored promises. All three IDs can be pinned via environment variables for multi-console / multi-site accounts.

**Retries.** A request is tried at most 3 times. `429` is retried on every method, honouring `Retry-After` (capped at 60 s), because the server rejected the request. `5xx` and dropped connections are retried only for `GET`; a `POST`, `PUT`, `PATCH` or `DELETE` is resent after a network error only when the connection was never established (for example `ECONNREFUSED`, `ENOTFOUND`), so a write that may already have reached UniFi is never duplicated. Redirects are refused (the API key never leaves the configured host) and timeouts are not retried. Network failures are returned as an error with the cause and logged at `warn`.

**Codegen pipeline.** A separate build step (`npm run codegen`) downloads the vendor OpenAPI documents (`developer.ui.com/<api>/<version>/openapi.json`) into `tests/fixtures/openapi/`, converts each catalogued operation into a Zod schema and emits one `.ts` file per endpoint. It writes nothing unless every catalog entry succeeds, and it fails on a vendor operation that is neither catalogued nor excluded. `npm run codegen -- --offline` regenerates from the committed documents; a unit test checks that the committed output equals that byte for byte. The output lives in `src/tools/generated/` and is committed to git so builds work offline.

## Security

- API key is read from `UNIFI_API_KEY` environment variable only. Never hardcoded.
- `.env` is gitignored.
- An MCP client config that holds the key in `env` (for example `claude_desktop_config.json`) stores it in plain text; keep that file private.
- The stderr logger redacts known secret patterns (`UNIFI_API_KEY=...`, `X-API-Key`, `Authorization`, `apiKey`, `api_key`, and `api_key` / `apikey` / `token` / `access_token` query parameters) and, by exact value, the configured API key wherever it appears. Output written by other tooling is not covered.
- Request paths are relative to the configured `UNIFI_API_BASE` origin, which must be `https://` (plain `http://` only for loopback test stubs); the API key is sent only to that origin and redirects are refused.
- Error texts from the UniFi API are scrubbed like log lines and cut to a fixed length before they reach the model.
- Keep `UNIFI_CONFIRM_WRITES=true` (the default) for a confirmation step on destructive operations.
- Tool results carry strings controlled by whoever can name things in your UniFi setup (device names, client hostnames, SSIDs, rule descriptions). The server instructions tell the model to treat them as data; your MCP client should still ask you before destructive tools run. The threat model is in [SECURITY.md](./SECURITY.md).

To report a vulnerability, please use [GitHub Security Advisories](https://github.com/mguttmann/the-real-unifi-mcp/security/advisories/new); do not open a public issue. See [SECURITY.md](./SECURITY.md).

## Maintenance status

- Maintained on a best-effort basis by one maintainer ([@mguttmann](https://github.com/mguttmann)) in spare time. There is no support contract and no guaranteed response time.
- Security fixes take priority over features. Report vulnerabilities privately (see [Security](#security)).
- Dependency updates come from Dependabot; CI fails when a runtime dependency has a known high or critical advisory.
- Only the latest minor release gets fixes.
- The `unifi_gen_*` tools follow the published UniFi API documentation; when Ubiquiti changes the API, they are regenerated in a later release. Open items are listed in [BACKLOG.md](./BACKLOG.md).
- Issues and pull requests are welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT, see [LICENSE](./LICENSE). The vendor OpenAPI documents in `tests/fixtures/openapi/` (Ubiquiti's developer documentation) are not covered by the MIT License; see [NOTICE](./NOTICE).
