# Repository settings (maintainers)

The workflows in `.github/workflows/` assume the GitHub and npm settings below. A workflow cannot set them itself; the repository owner applies them once, in the web UI or with the `gh api` calls shown. Some features (rulesets and private vulnerability reporting on a private repository, attestations) depend on the repository being public or on the GitHub plan.

`tests/unit/publication.test.ts` fails when a job is added to `ci.yml` without being listed in the required checks below.

## 1. Ruleset for `main`

Settings > Rules > Rulesets > New branch ruleset.

- Name `main`, enforcement **Active**, target **Default branch**, bypass actor **Repository admin** (the single maintainer can still merge alone; outside contributions go through pull requests and the required checks).
- **Restrict deletions** and **Block force pushes**.
- **Require a pull request before merging** (required approvals 0 while there is a single maintainer).
- **Require status checks to pass**, with **Require branches to be up to date before merging**. Required checks (job names of `.github/workflows/ci.yml`, GitHub Actions as the source):
  - `build (node 22.12.0)`, `build (node 22)`, `build (node 24)`, `build (node 26)`
  - `mcpb bundle`

The same jobs run again on every release tag: `release.yml` calls `ci.yml` on the tag commit and refuses a tag whose commit is not on `main`.

```bash
gh api -X POST repos/{owner}/{repo}/rulesets --input - <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [ { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" } ],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "build (node 22.12.0)" }, { "context": "build (node 22)" },
          { "context": "build (node 24)" }, { "context": "build (node 26)" },
          { "context": "mcpb bundle" }
        ] } }
  ]
}
JSON
```

## 2. Ruleset for release tags

Settings > Rules > Rulesets > New tag ruleset: name `release-tags`, enforcement **Active**, target pattern `v*`, bypass actor **Repository admin**, rules **Restrict creations**, **Restrict updates**, **Restrict deletions**. A tag push starts the release (and, once enabled, the npm publish); a published tag then cannot be moved to another commit.

## 3. Actions

Settings > Actions > General:

- **Workflow permissions**: *Read repository contents and packages permissions*. Every workflow declares its own minimal `permissions`; only the `github-release`, `npm-publish` and `mcp-registry` jobs of `release.yml` and the job of `mcp-registry.yml` (`id-token: write`, also when started by hand) ask for more.
- **Allow GitHub Actions to create and approve pull requests**: off.
- **Actions permissions**: allow actions created by GitHub (all actions in use are `actions/*`, pinned by commit SHA), and require actions to be pinned to a full-length commit SHA.
- **Fork pull request workflows**: require approval for all outside collaborators.

```bash
gh api -X PUT repos/{owner}/{repo}/actions/permissions/workflow \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
```

## 4. Code security

Settings > Code security:

- **Private vulnerability reporting**: on. `SECURITY.md` and `README.md` send reporters to `security/advisories/new`, which works only with this switch on.
- **Dependabot alerts** and **Dependabot security updates**: on. Version updates are configured in `.github/dependabot.yml`.
- **Secret scanning** with **push protection**: on.

```bash
gh api -X PUT repos/{owner}/{repo}/private-vulnerability-reporting
gh api -X PUT repos/{owner}/{repo}/vulnerability-alerts
gh api -X PUT repos/{owner}/{repo}/automated-security-fixes
```

## 5. npm publishing

The `npm-publish` job of `release.yml` publishes only when both are done:

- On npmjs.com, a trusted publisher for the package `the-real-unifi-mcp`: GitHub Actions, this repository, workflow file `release.yml`, no environment (the job declares none).
- The repository variable `NPM_PUBLISH_ENABLED` is `true` (`gh variable set NPM_PUBLISH_ENABLED --body true`).

The job then publishes the tarball the `build` job packed (checked against `SHA256SUMS`), after the GitHub release exists, with provenance through OIDC. It needs no `NPM_TOKEN`; it checks that its npm is 11.5.1 or newer, which trusted publishing requires.

Prerequisites, in this order:

1. **Public repository.** npm creates provenance statements only for packages built from a public source repository; the job fails on a private one.
2. **Trusted publisher** as above. The package already exists on npm, so no manual first publish is needed.
3. **Switch on** `NPM_PUBLISH_ENABLED`, then push the next release tag. Check that `npm-publish` succeeds, that the version on npmjs.com shows a provenance statement, and that `npm audit signatures` passes in a project that installs it.
4. Afterwards, in the package settings, require two-factor authentication and disallow tokens, so only the trusted publisher (and the maintainer with 2FA) can publish.

## 6. MCP Registry

`server.json` describes the server for the official MCP Registry (`registry.modelcontextprotocol.io`) as `io.github.<owner>/the-real-unifi-mcp`, with one package: the npm package `the-real-unifi-mcp`. The registry checks that npm serves that version with `mcpName` equal to the server name (`package.json` `mcpName`). No repository setting and no secret is needed:

- The `mcp-registry` job of `release.yml` runs `.github/workflows/mcp-registry.yml` for stable tags after a successful `npm-publish`. While npm publishing is off, it is skipped.
- The workflow can also be started by hand for an existing tag (Actions > MCP Registry > Run workflow, inputs `tag` and `npm-published`). It publishes only when npm serves the version with the right `mcpName`.
- Authentication is GitHub OIDC (`id-token: write`); the registry grants the namespace `io.github.<repository owner>/*`.
- A version the registry already lists is skipped, because registry versions are permanent. A listed version can be marked deprecated or deleted with `mcp-publisher status` after `mcp-publisher login github`; it cannot be replaced.
- `mcp-publisher` is pinned by version and SHA-256 in the workflow (`MCP_PUBLISHER_VERSION`, `MCP_PUBLISHER_SHA256`, value from the registry release's `registry_<version>_checksums.txt`).

## 7. Glama

Glama lists the repository at `https://glama.ai/mcp/servers/<owner>/the-real-unifi-mcp` on its own. The `glama.json` in the repository root names the GitHub users who may maintain that listing (`maintainers`); Glama reads it only during its "Claim" flow, so after a change to the file the maintainer runs the claim again.

Glama's tool inspection runs the server in a container configured in the listing's admin area (Node.js version, build steps, start command, environment). The server answers `tools/list` without calling the UniFi API, so placeholders are enough: any non-empty `UNIFI_API_KEY` and the default `UNIFI_API_BASE`. Never enter a real API key there.

## 8. One-time cleanup before going public

- **Internal documents in the history.** `docs/audit/` (removed from the tree in 0.2.1) is still in the history of `main` and of the tags from `v0.2.0` on, and describes a private deployment. Remove it from every commit before changing the visibility: in a fresh mirror clone run `git filter-repo --invert-paths --path docs/audit/`, check that `git log --all --oneline -- docs/audit` prints nothing, then force-push `main` and recreate the affected tags on the rewritten commits. The rewrite changes every commit id from the first audit commit on: update any consumer that pins a commit id, and rebase open branches onto the rewritten `main`. The npm packages are not affected (they never contained `docs/`).
- **Old pull request refs.** Closed pull requests keep their `refs/pull/*` and the commits they pointed at, also after a history rewrite of `main`; only GitHub Support can delete them. Decide before changing the visibility whether they may become public, and check `gh api repos/{owner}/{repo}/git/matching-refs/pull --jq length` afterwards.
- **Withdrawn releases.** The `.mcpb` assets of `v0.1.0` and `v0.1.1` contain the `unifi_raw_request` SSRF that can send the API key to another host (see `SECURITY.md`). Delete those assets (or releases) and note "Withdrawn: SSRF / API key exfiltration, use the latest release" in the release text.
- **npm 0.1.0.** 0.1.1 is deprecated on npm, 0.1.0 (same issue) is not: `npm deprecate the-real-unifi-mcp@0.1.0 "Security: SSRF / API-key exfiltration in unifi_raw_request. Upgrade to the latest version."`
- **Public maintainer data.** Check which e-mail address npm shows for the maintainer (`npm view the-real-unifi-mcp maintainers`) and change the npm profile address if needed.
- Then change the visibility (Settings > General) and apply sections 1 to 4.

## Check the result

```bash
gh api repos/{owner}/{repo}/rulesets
gh api repos/{owner}/{repo}/actions/permissions/workflow
gh api repos/{owner}/{repo}/private-vulnerability-reporting
gh api repos/{owner}/{repo}/vulnerability-alerts   # 204 when on
```
