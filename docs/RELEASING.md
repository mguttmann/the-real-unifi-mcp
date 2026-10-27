# Releasing

A release is built by `.github/workflows/release.yml` when a version tag is pushed. Nothing is published from a laptop.

## What the workflow does

| Job | What it does |
|---|---|
| `verify` | The tag must equal `v` + the `package.json` version, and the tag commit must be on `main`. A version with a `-` suffix (`0.3.0-rc.1`) is a prerelease. |
| `ci` | Runs the whole `ci.yml` on the tag commit (Node matrix, lint, typecheck, tests, build, `npm audit`, stdio smoke, MCPB bundle, secret scan). |
| `build` | `npm run build:mcpb` (clean build, `mcpb validate`, bundle runtime tree from the lockfile with `npm ci --omit=dev --ignore-scripts`, CycloneDX SBOMs via `npm sbom`), `npm pack`, then `SHA256SUMS` over the `.mcpb`, the `.tgz` and both `.cdx.json` files. |
| `github-release` | Build provenance attestation (only while the repository is public; skipped when private), then a new GitHub release with all assets. If a release for the tag already exists, the job fails; assets are never overwritten. |
| `npm-publish` | Only when the repository variable `NPM_PUBLISH_ENABLED` is `true`. Publishes the tarball from the `build` job (checked against `SHA256SUMS`) with `--provenance` through npm trusted publishing (OIDC, no token). Fails on a private repository, because npm provenance needs a public one. Stable versions go to the `latest` dist-tag, prereleases to `next`. |
| `mcp-registry` | Stable versions only, after a successful `npm-publish`: runs `mcp-registry.yml`, which lists `server.json` (version from the tag) in the MCP Registry once npm serves the version with the right `mcpName`. |

## Release steps

1. On a branch: bump `version` in `package.json`, `mcpb/manifest.json` and `server.json` (top level and the npm package) (`npm version --no-git-tag-version <x.y.z>` updates `package.json` and the lockfile; the manifest by hand). `tests/unit/contract.test.ts` fails if serverInfo or the manifest differ from `package.json`.
2. Move the `CHANGELOG.md` entries from "Unreleased" to the new version with the date; list contract changes under "Behaviour changes for callers".
3. Merge to `main` with green CI.
4. Tag the merge commit on `main` and push the tag: `git tag v<x.y.z> <sha> && git push origin v<x.y.z>`.
5. Check the workflow run and the release assets. To verify a download: `sha256sum --check SHA256SUMS`; with a public repository also `gh attestation verify <file> --repo mguttmann/the-real-unifi-mcp`.

A broken release is not repaired in place: delete the GitHub release by hand if needed and release a new version.

## Build the bundle locally

```bash
npm ci
npm run build:mcpb
```

Output in `release/`: `the-real-unifi-mcp-<version>.mcpb`, `the-real-unifi-mcp-<version>.mcpb.cdx.json` and `the-real-unifi-mcp-<version>.tgz.cdx.json`. The script fetches the pinned MCPB CLI with `npx` for `mcpb validate`, so it needs the npm registry. The archive is reproducible: two builds of the same commit with the same `zip` and npm give the same SHA-256 (timestamp from `SOURCE_DATE_EPOCH`, default the commit time of `HEAD`).

## Owner settings (not done by the workflow)

GitHub rulesets, Actions and security settings, npm trusted publishing, the MCP Registry and Glama are described in [maintainers/repo-settings.md](./maintainers/repo-settings.md).

- **npm publishing is off.** To turn it on: make the repository public (provenance needs it), configure a trusted publisher for `the-real-unifi-mcp` on npmjs.com (repository `mguttmann/the-real-unifi-mcp`, workflow `release.yml`), then set the repository variable `NPM_PUBLISH_ENABLED=true`.
- **Attestations** are created only while the repository is public.
- Protect `main` and tags `v*` so that only maintainers can push them; the `verify` job checks that the tag commit is on `main`, but it cannot stop someone from pushing a tag.
