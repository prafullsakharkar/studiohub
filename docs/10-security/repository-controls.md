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

## Known gaps

- The MinIO images the compose files reference are no longer published at `quay.io/minio`, so they
  cannot be pinned (see `docs/10-security/tpn-immediate-remediation.md`).
- nginx and postgres images start as root by design of the official images; accepted with an expiry in
  `.trivyignore.yaml`.
