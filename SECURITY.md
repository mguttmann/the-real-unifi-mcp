# Security Policy

## Supported versions

Only the latest minor release (`0.1.x`) receives security fixes at this time.

## Reporting a vulnerability

**Please do not open public GitHub issues for security problems.**

Use [GitHub Security Advisories](https://github.com/mguttmann/the-real-unifi-mcp/security/advisories/new) — this routes the report privately to the maintainer.

What to include:
- Affected version (commit SHA or release tag)
- Reproduction steps
- Impact assessment (data exposure, write access, denial of service, …)
- Suggested fix if you have one

You can expect an acknowledgement within 72 hours and a fix or mitigation within 14 days for confirmed issues.

## API key hygiene

The UniFi Site Manager API key controls your entire network — treat it as a production credential:

- Never commit it. `.env` is gitignored; use it for local key storage.
- Never paste it into a chat that may be logged or summarised.
- Rotate the key in the UniFi Site Manager console if it has ever been exposed.
- This MCP server redacts known secret patterns from its own log output, but external tooling (process lists, debuggers, container logs) may still capture environment variables.

## Destructive operations

**By default (`UNIFI_CONFIRM_WRITES` unset or `false`), write and delete tools execute immediately with no confirmation step.** For an extra confirmation layer, set `UNIFI_CONFIRM_WRITES=true` — destructive calls will then return a redacted preview unless invoked with `confirm: "YES"`. All mutating tools also carry the MCP `destructiveHint` annotation so a well-behaved client can prompt before executing.

## Raw request escape hatch

`unifi_raw_request` issues an HTTP request to a caller-supplied path against the configured UniFi API base. Only ever point this server at the official `https://api.ui.com` base (the default). The `X-API-Key` credential is attached to outgoing requests, so a request directed at an unintended host could disclose it; treat the `path` argument as trusted input and do not expose this tool to untrusted prompt content without review.
