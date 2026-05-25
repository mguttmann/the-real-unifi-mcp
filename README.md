# the-real-unifi-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.x-blue)](https://github.com/modelcontextprotocol/typescript-sdk)
[![CI](https://github.com/mguttmann/the-real-unifi-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/mguttmann/the-real-unifi-mcp/actions/workflows/ci.yml)

> MCP server for UniFi Site Manager + Network APIs. 100% API coverage, cloud-only, stdio transport.

## Features

- 167 tools across both UniFi APIs (read AND write).
- Three-layer design: ergonomic hand-wrappers + 80 auto-generated tools for full coverage + a raw-request escape hatch.
- 3 MCP Resources, 3 MCP Prompts.
- Lazy ID discovery (consoleId / Network siteId / Site Manager siteId), cached for process lifetime.
- Optional `UNIFI_CONFIRM_WRITES` preview mode for destructive tools.
- Secret redaction in all stderr log output.

## Requirements

- Node.js ≥ 20.
- UniFi Site Manager API key with Network scope. Create one at [unifi.ui.com](https://unifi.ui.com) under Settings → API.
- UniFi Console with firmware ≥ 5.0.3 (required by the Network API).

## Installation

### From source

```bash
git clone https://github.com/mguttmann/the-real-unifi-mcp.git
cd the-real-unifi-mcp
npm install
cp .env.example .env
# Edit .env: set UNIFI_API_KEY (Site Manager key with Network scope)
npm run build
npm start
```

### As MCPB bundle

```bash
npm run build:mcpb
# Resulting `the-real-unifi-mcp-<version>.mcpb` can be installed directly in Claude Desktop.
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `UNIFI_API_KEY` | (required) | Site Manager API key with Network scope |
| `UNIFI_API_BASE` | `https://api.ui.com` | API base URL |
| `UNIFI_CONFIRM_WRITES` | `false` | If true, destructive tools require `confirm: "YES"` |
| `UNIFI_TIMEOUT_MS` | `30000` | Per-request timeout (ms) |
| `UNIFI_LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `UNIFI_CONSOLE_ID` | — | Override discovery (pin to a specific console) |
| `UNIFI_NETWORK_SITE_ID` | — | Override discovery (pin to a specific Network site) |
| `UNIFI_SITE_MANAGER_SITE_ID` | — | Override discovery (pin to a specific Site Manager site) |

## Claude Desktop config

Add to `claude_desktop_config.json` (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "unifi": {
      "command": "node",
      "args": [
        "--env-file=/absolute/path/to/the-real-unifi-mcp/.env",
        "/absolute/path/to/the-real-unifi-mcp/dist/index.js"
      ]
    }
  }
}
```

Restart Claude Desktop after editing the file. The server exposes its tools under the `unifi` prefix.

## Claude Code config

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "unifi": {
      "command": "node",
      "args": [
        "--env-file=/absolute/path/to/the-real-unifi-mcp/.env",
        "/absolute/path/to/the-real-unifi-mcp/dist/index.js"
      ]
    }
  }
}
```

## Tool reference

### Site Manager hand-wrappers (10)

Account-level tools against `api.ui.com` directly:

- `unifi_sm_list_hosts` — list all UniFi consoles on the account
- `unifi_sm_get_host` — detail for a single console
- `unifi_sm_list_sites` — account-level sites
- `unifi_sm_list_devices` — account-level device list
- `unifi_sm_get_isp_metrics` — ISP metrics by bucket (5m/1h)
- `unifi_sm_query_isp_metrics` — query ISP metrics with a time window
- `unifi_sm_list_sdwan_configs` — SD-WAN configurations
- `unifi_sm_get_sdwan_config` — single SD-WAN configuration
- `unifi_sm_get_sdwan_config_status` — status of an SD-WAN configuration
- `unifi_sm_identity` — resolved consoleId, networkSiteId, siteManagerSiteId

### Network hand-wrappers (76)

Per-console tools via the Cloud Connector proxy, grouped by resource:

- **Info / Sites (2):** `unifi_net_get_info`, `unifi_net_list_sites`
- **Devices (9):** `unifi_net_list_devices`, `unifi_net_get_device`, `unifi_net_get_device_stats`, `unifi_net_list_pending_devices`, `unifi_net_adopt_devices`, `unifi_net_device_action`, `unifi_net_reboot_device`, `unifi_net_port_action`, `unifi_net_remove_device`
- **Clients (5):** `unifi_net_list_clients`, `unifi_net_get_client`, `unifi_net_client_action`, `unifi_net_block_client`, `unifi_net_unblock_client`
- **Networks (6):** `unifi_net_list_networks`, `unifi_net_get_network`, `unifi_net_get_network_references`, `unifi_net_create_network`, `unifi_net_update_network`, `unifi_net_delete_network`
- **WiFi broadcasts (5):** `unifi_net_list_wifi`, `unifi_net_get_wifi`, `unifi_net_create_wifi`, `unifi_net_update_wifi`, `unifi_net_delete_wifi`
- **Firewall (13):** `unifi_net_list_firewall_zones`, `unifi_net_get_firewall_zone`, `unifi_net_create_firewall_zone`, `unifi_net_update_firewall_zone`, `unifi_net_delete_firewall_zone`, `unifi_net_list_firewall_policies`, `unifi_net_get_firewall_policy`, `unifi_net_create_firewall_policy`, `unifi_net_update_firewall_policy`, `unifi_net_patch_firewall_policy`, `unifi_net_delete_firewall_policy`, `unifi_net_get_firewall_policy_ordering`, `unifi_net_reorder_firewall_policies`
- **ACL rules (7):** `unifi_net_list_acl_rules`, `unifi_net_get_acl_rule`, `unifi_net_create_acl_rule`, `unifi_net_update_acl_rule`, `unifi_net_delete_acl_rule`, `unifi_net_get_acl_rule_ordering`, `unifi_net_reorder_acl_rules`
- **DNS policies (5):** `unifi_net_list_dns_policies`, `unifi_net_get_dns_policy`, `unifi_net_create_dns_policy`, `unifi_net_update_dns_policy`, `unifi_net_delete_dns_policy`
- **Traffic matching lists (5):** `unifi_net_list_traffic_lists`, `unifi_net_get_traffic_list`, `unifi_net_create_traffic_list`, `unifi_net_update_traffic_list`, `unifi_net_delete_traffic_list`
- **Hotspot vouchers (5):** `unifi_net_list_vouchers`, `unifi_net_get_voucher`, `unifi_net_create_vouchers`, `unifi_net_delete_voucher`, `unifi_net_delete_vouchers`
- **Switching (6):** `unifi_net_list_switch_stacks`, `unifi_net_get_switch_stack`, `unifi_net_list_mclag_domains`, `unifi_net_get_mclag_domain`, `unifi_net_list_lags`, `unifi_net_get_lag`
- **Supporting (8):** `unifi_net_list_wans`, `unifi_net_list_site_to_site_vpn`, `unifi_net_list_vpn_servers`, `unifi_net_list_radius_profiles`, `unifi_net_list_device_tags`, `unifi_net_list_dpi_application_categories`, `unifi_net_list_dpi_applications`, `unifi_net_list_countries`

### Auto-generated tools (80)

Named `unifi_gen_<docpage>` (e.g. `unifi_gen_createfirewallpolicy`, `unifi_gen_getinfo`). One tool per documented UniFi API endpoint. siteId is auto-resolved from discovery — callers do not need to pass it. See `src/tools/generated/` for the full inventory.

### Escape hatch (1)

`unifi_raw_request(method, path, body?, query?)` — execute any HTTP method against `api.ui.com{path}`. Auth, retry, error parsing, and pagination hints are handled automatically. Useful when no dedicated tool exists.

## Resources

- `unifi://identity` — resolved consoleId + both siteIds + console metadata
- `unifi://hosts` — account hosts list
- `unifi://hosts/{id}` — single host detail

## Prompts

- `unifi-audit-firewall` — walks firewall zones and policies, flags weak rules, suggests hardening
- `unifi-network-health` — WAN status, online/offline device counts, top clients by activity
- `unifi-adoption-status` — pending adoptions report with adopt/reject recommendation

## Write safety

By default, destructive tools execute directly. Set `UNIFI_CONFIRM_WRITES=true` to require an explicit `confirm: "YES"` argument; otherwise destructive calls return a redacted preview:

```json
{
  "data": {
    "preview": {
      "tool": "unifi_net_create_vouchers",
      "method": "POST",
      "url": "/v1/connector/consoles/.../proxy/network/integration/v1/sites/.../hotspot/vouchers",
      "body": { "count": 1, "name": "demo" }
    },
    "hint": "UNIFI_CONFIRM_WRITES=true is set. Re-run with confirm: \"YES\" to apply this change."
  }
}
```

## Examples

Prompts you can paste into Claude after installing the server:

- "Show me all my UniFi networks and their VLAN IDs."
- "Which of my UniFi devices are offline right now?"
- "Audit my firewall posture — group rules by zone and flag any allow-any-any."
- "Reboot the access point named `AP-Office-1`."
- "Block the client with MAC `aa:bb:cc:dd:ee:ff` until I unblock it."

Destructive examples respect `UNIFI_CONFIRM_WRITES` — when set, the model will first ask for confirmation before applying.

## Troubleshooting

**"Discovery: multiple consoles match …"**
Your Site Manager account has more than one UniFi console. Set `UNIFI_CONSOLE_ID=<id>` from one of the listed IDs. The same pattern applies to multi-Network-site (`UNIFI_NETWORK_SITE_ID`) and multi-Site-Manager-site (`UNIFI_SITE_MANAGER_SITE_ID`) cases.

**`401 Unauthorized`**
The API key is missing the Network scope or has been revoked. Re-generate the key at [unifi.ui.com](https://unifi.ui.com) with both `Site Manager` and `UniFi Applications → Network` scopes enabled. Rotate any key that has ever been exposed in a chat or commit.

**Tools not showing in Claude Desktop**
Restart Claude Desktop after editing `claude_desktop_config.json` — config changes are only picked up on startup. The MCP log is at `~/Library/Logs/Claude/mcp-server-unifi.log` (macOS) — check it for startup errors or discovery failures.

## Development

```bash
npm run dev                  # tsx watch
npm test                     # unit tests
npm run test:integration     # live read-only smoke (needs UNIFI_API_KEY)
npm run codegen              # regenerate src/tools/generated/ from UniFi docs
npm run inspector            # MCP Inspector
npm run build:mcpb           # build MCPB bundle artifact
npm run lint                 # ESLint
npm run typecheck            # tsc --noEmit
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

## Architecture

**Three-layer tool design.** Hand-wrappers (`unifi_sm_*`, `unifi_net_*`) provide ergonomic, well-documented entry points for common operations with auto-resolved IDs and named arguments. The 80 auto-generated tools (`unifi_gen_*`) guarantee complete coverage of every documented endpoint, with input schemas derived from the upstream UniFi docs. `unifi_raw_request` is the escape hatch for anything not covered by the first two layers.

**Lazy ID discovery.** On first use, the server calls `GET /v1/hosts` to find the owned console, then `GET /v1/sites` (Network and Site Manager) to discover both siteIds. Results are cached for the process lifetime. Concurrent callers share a single in-flight request via stored promises. All three IDs can be pinned via environment variables for multi-console / multi-site accounts.

**Codegen pipeline.** A separate build step (`npm run codegen`) fetches each documented endpoint page from `developer.ui.com` using the `RSC: 1` header, runs a balanced-brace parser to extract the `"endpoint":{...}` block, converts the OpenAPI-style schema into a Zod expression, and emits one `.ts` file per endpoint. The output lives in `src/tools/generated/` and is committed to git so production builds work offline.

## Security

- API key is read from `UNIFI_API_KEY` environment variable only. Never hardcoded.
- `.env` is gitignored.
- The stderr logger redacts five known secret patterns (`UNIFI_API_KEY=…`, `X-API-Key`, `Authorization`, `apiKey`, `api_key`).
- Set `UNIFI_CONFIRM_WRITES=true` for an extra confirmation step on destructive operations.

To report a vulnerability, please use [GitHub Security Advisories](https://github.com/mguttmann/the-real-unifi-mcp/security/advisories/new) — do not open a public issue. See [SECURITY.md](./SECURITY.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
