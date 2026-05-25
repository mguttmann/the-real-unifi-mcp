# the-real-unifi-mcp

MCP server for UniFi Site Manager + Network APIs. 100% coverage, hybrid hand-wrappers + auto-generated tools, cloud-only via `api.ui.com`. Stdio transport.

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env: set UNIFI_API_KEY (Site Manager key with Network scope)
npm run build
npm start
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `UNIFI_API_KEY` | (required) | Site Manager API key with Network scope |
| `UNIFI_API_BASE` | `https://api.ui.com` | API base URL |
| `UNIFI_CONFIRM_WRITES` | `false` | If true, destructive tools require `confirm: "YES"` |
| `UNIFI_TIMEOUT_MS` | `30000` | Per-request timeout |
| `UNIFI_LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `UNIFI_CONSOLE_ID` | — | Override discovery |
| `UNIFI_NETWORK_SITE_ID` | — | Override discovery |
| `UNIFI_SITE_MANAGER_SITE_ID` | — | Override discovery |

## Claude Desktop config

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "unifi": {
      "command": "node",
      "args": ["/absolute/path/to/the-real-unifi-mcp/dist/index.js"],
      "env": { "UNIFI_API_KEY": "your_key_here" }
    }
  }
}
```

Or install via the MCPB bundle: `npm run build:mcpb` → install `.mcpb` file in Claude Desktop.

## Tool layers

- `unifi_sm_*` — Site Manager hand-wrappers (account-level: hosts, sites, devices, ISP metrics, SD-WAN). ~10 tools.
- `unifi_net_*` — Network hand-wrappers (per-console: devices, clients, networks, WLANs, firewall, ACL, DNS, hotspot, switching, supporting). ~75 tools.
- `unifi_gen_*` — auto-generated from UniFi docs (~80 tools). Use when no hand-wrapper exists.
- `unifi_raw_request` — escape hatch for any path/method.

## Resources

- `unifi://identity` — resolved consoleId, networkSiteId, siteManagerSiteId, console metadata.
- `unifi://hosts` — account hosts list.
- `unifi://hosts/{id}` — host detail.

## Prompts

- `unifi-audit-firewall` — firewall posture audit.
- `unifi-network-health` — WAN/devices/clients summary.
- `unifi-adoption-status` — pending adoptions report.

## Write safety

By default, destructive tools execute directly. Set `UNIFI_CONFIRM_WRITES=true` to require an explicit `confirm: "YES"` argument; otherwise destructive calls return a redacted preview.

## Develop

```bash
npm run dev          # tsx watch
npm test             # unit tests
npm run test:integration   # live read-only (needs UNIFI_API_KEY)
npm run lint
npm run typecheck
npm run codegen      # regenerate src/tools/generated from UniFi docs
npm run inspector    # MCP Inspector
```

## Security

- API key is read from `UNIFI_API_KEY` env only. Never hardcode. `.env` is gitignored.
- Logger redacts known secret patterns from output.
- **If your key has ever been pasted into a chat or commit, rotate it.**

## License

MIT
