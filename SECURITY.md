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

By default, write tools execute directly. For an extra confirmation layer, set `UNIFI_CONFIRM_WRITES=true` — destructive calls will then return a redacted preview unless invoked with `confirm: "YES"`.
