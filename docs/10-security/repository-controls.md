# Repository controls

What the repository enforces by itself, and the GitHub settings that must be switched on by a
repository administrator, because they cannot be set from a commit.

## In the repository

| Control | Where |
|---|---|
| Lint, system check, migration drift, tests with a coverage floor | `.github/workflows/ci.yml` (job `backend`) |
| Static security analysis (flake8-bandit rules) | `backend/ruff.toml` (`S`), run by `ruff check` |
| Secret scan of every push and pull request | `ci.yml` (job `secrets`), `.gitleaks.toml` |
| Dependency audit of the locked runtime set, weekly | `.github/workflows/dependency-audit.yml` |
| Image build, image vulnerability scan, Dockerfile and compose misconfiguration scan, weekly | `.github/workflows/containers.yml`, `.trivyignore.yaml` |
| Actions pinned to commit SHAs; token limited to `contents: read`; no persisted checkout credentials | all workflows |
| Base images pinned by digest | `infrastructure/docker/*/Dockerfile`, `infrastructure/compose/compose.yml` |
| Dependency, Actions and image update PRs | `.github/dependabot.yml` |
| Required reviewers for security-sensitive paths | `.github/CODEOWNERS` |
| How to report a vulnerability | `SECURITY.md` |

Updating a pinned digest or SHA is Dependabot's job; the version tag next to each pin is a comment
for readers, the digest or SHA is what is used.

## To switch on in GitHub (repository administrator)

Settings → Branches → branch protection rules for `main` and `develop`:

- Require a pull request before merging; require review from code owners.
- Require status checks to pass: `Backend (ruff + pytest)`, `Secret scan (gitleaks)`,
  `Runtime dependencies (pip-audit)`, `Dockerfile and compose misconfiguration`,
  `Production image vulnerabilities`.
- Dismiss stale approvals on new commits; require conversation resolution.
- Block force pushes and branch deletion; include administrators.
- With a single maintainer, a required approval cannot be given by the author: either add a second
  reviewer or leave the approval count at zero and keep the status checks and code-owner file as the
  record of intent.

Settings → Code security:

- Enable Dependabot alerts and security updates, secret scanning with push protection, and private
  vulnerability reporting (the route named in `SECURITY.md`).

## State observed on GitHub (28 October 2026)

Read with `infrastructure/scripts/github-settings.sh`:

- The repository is **public**. Anything committed is published; see `secrets-rotation.md`. Confirm that is
  intended.
- Secret scanning and push protection are on. Dependabot alerts and security updates were off, and
  neither `main` nor `develop` had branch protection.
- `github-settings.sh` shows this and, with `--apply`, enables Dependabot alerts and security updates,
  private vulnerability reporting, and branch protection (no force push or deletion, CI checks must pass,
  one code-owner review on pull requests; administrators are not forced to follow it unless
  `ENFORCE_ADMINS=true`). `REQUIRED_REVIEWS=0` drops the review requirement for a one-maintainer repository.
- **Applied on 28 October 2026** (owner's choice: alerts on; branch rules without a required review, because
  there is one maintainer): Dependabot alerts and security updates, private vulnerability reporting, and on
  `main` and `develop` no force push, no deletion and the checks `Backend (ruff + pytest)`, `Secret scan
  (gitleaks)` and `Docs (link check)` required on pull requests. Administrators are exempt
  (`enforce_admins` false). Add a second reviewer and re-run with `REQUIRED_REVIEWS=1` to require review.
- The first runs of the new workflows: `Dependency audit` and `Containers` passed on the push that carried
  them; `CI` failed on one seed test whose fallback parser corrupted URLs when `node` was unavailable
  (fixed, with a test that forces the fallback).

## Known gaps

- nginx and postgres images start as root by design of the official images; accepted with an expiry in
  `.trivyignore.yaml`.
