# TPN review: immediate remediation (items 1 to 5)

Changes made after the repository review for the TPN / MPA content-security assessment. Each item
names the review finding it answers (TM-nnn). Operator steps are at the end: they cannot be done
from the repository.

## 1. Attachments are owner-scoped and validated (TM-001)

- `AttachmentSelector` narrows every list, retrieve, update and delete to the files the caller
  uploaded. Someone else's file is a 404. Superusers (break-glass) see all. Expired files are hidden
  from their owner.
- Core must not import a business domain, so the scope is ownership, not project. Project-level
  sharing (a reviewer seeing a vendor's attachment) needs a project reference on the attachment and
  a membership provider registered by `production`; that is a follow-up and a product decision.
- Uploads: allow-list of extensions (`ATTACHMENT_ALLOWED_EXTENSIONS`), size cap
  (`ATTACHMENT_MAX_BYTES`, 512 MB), empty files refused, and content that starts like a web page or
  script is refused whatever the extension. `file_size` and `mime_type` come from the file, not the
  client. The stored extension is sanitized.
- `created_by` / `updated_by` are set from the request. Upload, update, delete and download write
  structured log events (`attachment_uploaded`, `attachment_updated`, `attachment_deleted`,
  `attachment_downloaded`) with user, attachment and client IP. Database audit rows are not written
  from core; that needs the audit app and is a follow-up.
- `is_public` is kept for contract compatibility but grants nothing: no attachment is readable
  anonymously.

## 2. Files leave only through a signed link (TM-005, part of TM-023)

- `file` and `download_url` in an attachment response are now
  `/api/v1/core/attachments/<id>/download/?token=...`. The token is signed, bound to the attachment
  and the user, and valid for `ATTACHMENT_LINK_TTL_SECONDS` (300). The endpoint re-checks on every
  use: user still active, attachment still visible to that user, not expired, not deleted. A plain
  `<a href>` or `<img src>` works; no Authorization header is needed.
- The response is an inert download: `Content-Disposition: attachment`, `nosniff`,
  `Content-Security-Policy: default-src 'none'; sandbox`, `Cache-Control: private, no-store`.
- nginx no longer serves `/media/` by path. `/media/attachments/...` and everything else under
  `/media/` is 404; only `avatars/` and `branding/` stay readable. With `MEDIA_ACCEL_PREFIX` set, the
  application hands the file to the `internal` location `/_protected_media/` (X-Accel-Redirect) after
  authorizing the link; without it Django streams the file (development).
- nginx also sends HSTS and `nosniff` at server level.

Contract note for the front end: use `download_url` (or `file`) as the link target as returned; do not
build `/media/...` URLs. Links expire after five minutes, so request the attachment again rather than
storing the link. A `/media/...` URL stored earlier no longer works.

## 3. Redis is authenticated (TM-003)

- `compose.prod.yml` starts Redis with `--requirepass` from `REDIS_PASSWORD` and refuses to start
  without one. Its config (`redis.prod.conf`) has `protected-mode yes`; the health check logs in.
- `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` must carry the same password
  (`redis://:<password>@redis:6379/1`). The cache URL already does when `REDIS_PASSWORD` is set.
- `manage.py check --deploy` (run by `start-prod.sh` before the server starts) fails with `core.E001`
  when the cache, broker or result backend is a Redis URL without a password.
- The development Redis config is unchanged.

## 4. Admin site and API docs (TM-004, TM-010)

- `/admin/` is mounted only when `DJANGO_DEBUG` is on or `ADMIN_ENABLED=true`. The OpenAPI schema and
  Swagger UI likewise need `API_DOCS_ENABLED=true`. Both default to off.
- The schema requires an authenticated caller when it is mounted.
- nginx returns 404 for `/admin/` and `/api/schema*` on the public proxy. To use the admin, reach
  Django over a private network or tunnel, set `ADMIN_ENABLED=true`, and expect the deploy check
  warning `core.W001`: the admin login still does not use the API's MFA or lockout.

## 5. Secrets (TM-006)

- `check --deploy` also fails (`core.E002`) when `DJANGO_SECRET_KEY` is shorter than 32 characters
  or looks like a placeholder. That key signs the access and refresh tokens.
- CI has a `secrets` job (gitleaks) over the commits of each push or pull request; `.gitleaks.toml`
  allows only the test-only keys.
- The untracked local env files were set to mode 600 on the assessed host.

## Operator steps (not done by the code)

1. Set in the production env file: `REDIS_PASSWORD`, the two Celery URLs with the same password,
   `MEDIA_ACCEL_PREFIX=/_protected_media`, `ADMIN_ENABLED=false`, `API_DOCS_ENABLED=false`.
   Use URL-safe characters for the Redis password (`secrets.token_hex(32)`).
2. Rebuild and restart nginx and the stack together; the nginx and Django changes depend on each other.
3. Rotate every credential that could have been in the July 2026 commits that touched the compose env
   file, and any secret kept in a world-readable file: `DJANGO_SECRET_KEY` (this signs out everyone),
   database, Redis, MinIO, `API_KEY_PEPPER` (invalidates every API key and PAT), `MFA_ENCRYPTION_KEY`
   and `DELIVERY_SECRET_KEY` (add the new key first and keep the old one in the list so existing data
   stays readable). Then run `gitleaks detect` over the full history to find what else needs it.
4. Check the file permissions on the production host, not only the development machine.
5. Move any file that must stay downloadable by its link out of `/media/` direct references in the
   front end.
6. Audit: set `AUDIT_RETENTION_DAYS`, `API_REQUEST_RETENTION_DAYS` and `TRACK_RETENTION_DAYS` to the
   periods your policy requires, run `manage.py migrate` (adds `project_id` and the triggers), make sure
   Celery beat runs (or schedule `manage.py audit_purge`), and send container logs to a central collector.

# Follow-up: mail, client address, and the publishing index (TM-017, TM-014)

- **Mail (TM-017).** `EMAIL_HOST` and `EMAIL_PORT` were read from the environment and then dropped, so
  production sent through Django's default local relay without TLS, and the reset email had no link
  base. They now reach Django settings together with `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`,
  `EMAIL_USE_TLS` / `EMAIL_USE_SSL`, `DEFAULT_FROM_EMAIL` and `FRONTEND_BASE_URL`, and sends time out
  after 10 s. `check --deploy` fails (`core.E003`) for SMTP without TLS, and (`core.E004`) when
  `FRONTEND_BASE_URL` is not an `https://` address; `core.W003` warns about the placeholder sender.
- **Client address (TM-014).** nginx now sets `X-Forwarded-For` to the address that connected instead of
  appending to what the client sent. The compose backend network has a fixed subnet
  (`172.31.250.0/24`), which the templates use for both `TRUSTED_PROXY_IPS` (the application) and
  `FORWARDED_ALLOW_IPS` (uvicorn; it falls back to `TRUSTED_PROXY_IPS`). `check --deploy` warns
  (`core.W004`) when `TRUSTED_PROXY_IPS` is empty. Behind another load balancer, add nginx
  `set_real_ip_from` / `real_ip_header` so it carries the real address on.
- **Publishing index.** `publishing_file_proj_status_idx` was 31 characters; Django allows 30, and
  `migrate` stopped on it (`models.E034`) while the plain `check` CI runs did not. Renamed to
  `publishing_file_proj_stat_idx` (migration `publishing 0002`), with a test that runs the
  database-aware model checks.

Operator steps: set `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS=true`, `DEFAULT_FROM_EMAIL`
and `FRONTEND_BASE_URL`; set `TRUSTED_PROXY_IPS` and `FORWARDED_ALLOW_IPS` to the proxy range (the
templates already do); recreate the compose network once so the fixed subnet takes effect
(`docker compose down` then `up`); run `migrate`.

# Follow-up: user administration and membership lists (TM-022, TM-018)

- **Target rule.** Administering a user (update, delete, activate, deactivate, archive, restore,
  suspend, change or reset password, force password change, revoke sessions) is refused when the
  target outranks the actor: a superuser can be administered only by a superuser, and nobody can
  administer a user who holds permissions they do not. Before, a holder of `identity.user.reset_password`
  could force a reset and revoke every session of a superuser.
- **Staff and activation.** Only a superuser can grant or remove `is_staff`. Changing `is_active`
  through a plain update now needs the activate or deactivate permission.
- **Membership lists.** `GET roles/<id>/users/` and `GET groups/<id>/members/` return user ids and emails
  and now need `identity.role.view` / `identity.group.view`. No seeded role holds those codes, so
  grant them to the roles whose holders manage access; superusers are unaffected. The role, group and
  permission lists themselves stay open.
- Contracts SEC-AUTHZ-06, -07 and -08 in `docs/identity/CONTRACTS.md`.

# Follow-up: credential-protection switches and upload limits (TM-019, TM-015)

- **Switches (TM-019).** `check --deploy` (run by `start-prod.sh`) now fails with `core.E005` when
  `MFA_ENCRYPTION_ENABLED=false` (TOTP secrets in plaintext) and warns with `core.W005` while
  `API_KEY_ACCEPT_LEGACY_HASH` is true. The latter is now an environment variable. Legacy keys upgrade
  only when used, so a rarely used one stays on the old digest: `manage.py legacy_credentials` lists
  them, `--revoke` revokes them (owners reissue), and then the switch can go to `false`.
  If production runs with MFA encryption off, run `manage.py mfa_encrypt_secrets` after turning it on,
  or the next start is refused.
- **Upload limits (TM-015).** nginx's body limit is 10 MB everywhere except the attachment upload route
  (520 MB, the application limit plus form overhead), replacing 20 GB; proxy timeouts are 120 s (600 s
  for uploads) instead of an hour; header and body timeouts cut off stalled clients. The application
  adds a per-user quota (`ATTACHMENT_USER_QUOTA_BYTES`, 5 GB of live attachments) and a per-user upload
  rate limit (`upload`, 60 per hour). A request over a limit gets 413, 400 or 429.

# Follow-up: session lifetime and browser headers (TM-020, TM-023)

- **Sessions (TM-020).** Refresh tokens now last 7 days (were 30) and a session ends 30 days after it
  began (the 90-day figure was never in force: the setting was not exported, so the service used its
  fallback). A session with no authenticated request for `SESSION_IDLE_TIMEOUT_MINUTES` (default 120,
  0 turns it off) cannot be refreshed and is expired. A refresh does not count as activity, so a
  front end that refreshes in the background does not keep an unattended session alive. Sessions that
  were already idle when this deploys must sign in again at their next refresh.
- **Token storage.** Tokens are still returned in response bodies. With the proxy's strict
  `Content-Security-Policy` (`default-src 'none'` for everything it serves) and these lifetimes the
  exposure is smaller, but how the web client stores them is a front-end decision this repository
  cannot settle: prefer memory for the access token, and ask for the refresh token to move to an
  `HttpOnly` cookie if the client allows it.
- **Headers (TM-023).** The proxy is now authoritative for HSTS, `nosniff`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and a CSP of
  `default-src 'none'; frame-ancestors 'none'; base-uri 'none'`, on its own responses and on proxied
  ones; the application's copies are hidden so none is sent twice (checked against a real nginx and a
  stub upstream). Uploads keep their stricter `sandbox` policy. The application also sends
  `Permissions-Policy` and the CSP for non-HTML responses, for deployments without this proxy.

# Follow-up: CI and supply chain (TM-016)

- **Production image contents.** `.dockerignore` patterns such as `.venv/`, `media/` and `__pycache__/`
  matched only at the root of the build context, but the Dockerfile copies `backend/`. The image
  therefore carried a developer's `.venv` (785 MB, Python 3.13 and dev tools), `backend/media` (120 MB of
  local uploaded files), logs, caches and a `.coverage` file. No env file got in. Patterns now start with
  `**/`; the image went from 1.57 GB to about 370 MB, `/app` from 785 MB to 20 MB. The runtime stage
  also removes the base image's own `pip` (which vendors copies of urllib3 and msgpack the scanner
  flagged), so production has no package installer. **If images built before this were pushed to a
  registry, treat their contents (including any media files) as exposed to whoever can pull them.**
- **Pinning.** GitHub Actions are pinned to commit SHAs and base images to digests, with the version tag
  kept as a comment; Dependabot proposes updates (now including the compose files). Workflow tokens are
  limited to `contents: read` and checkouts do not persist credentials.
- **Scanning.** New `Containers` workflow: builds the production image, checks it carries no
  development files, scans it with Trivy (fixed HIGH/CRITICAL fail the job) and scans the Dockerfiles
  and compose files for misconfigurations; weekly and on change. Trivy runs from a digest-pinned image
  and reads the built image as a file, never the Docker socket. Accepted findings are in
  `.trivyignore.yaml` with reasons and an expiry. The first run of the image scan found nothing in the
  final image; it found the leaks above in the first build.
- **Static analysis.** flake8-bandit (`S`) rules are part of the normal `ruff check`. Classes that only
  flag names or style are switched off in `ruff.toml` with the reason; the three real hits (md5 used as
  a cache key and fingerprint helper, a development command that runs node) are annotated.
- **Controls.** `CODEOWNERS`, `SECURITY.md` and `docs/10-security/repository-controls.md` (including the
  GitHub settings an administrator must switch on).
- **Verified:** the production image builds and imports the upgraded stack (Pillow 13, Django 6.0.9,
  DRF 3.18.3, PyJWT 2.15.1) on Python 3.14.10 as UID 10001.

# Follow-up: audit trail integrity, retention and visibility (TM-011, TM-012)

- **Append-only (TM-011).** `audit_logs`, `change_logs` and `api_requests` refuse changes in the model
  and in the database (a trigger on `UPDATE` and `DELETE`), so a compromised application account cannot
  quietly rewrite history. Only the retention job may delete, inside a transaction that sets a flag the
  trigger checks. `TRUNCATE` is not guarded: do not grant the application role `TRUNCATE` on these tables
  in production, and keep the database owner separate from the application role.
- **Retention (TM-011).** Daily `audit.purge` (and `manage.py audit_purge --dry-run`) with
  `AUDIT_RETENTION_DAYS` (730), `API_REQUEST_RETENTION_DAYS` (180), `TRACK_RETENTION_DAYS` (90). Each purge
  that removes rows is itself logged.
- **Visibility (TM-012).** Audit and change logs carry a `project_id`; a non-administrator reads only the
  projects they are an internal member of. API requests and tracks are limited to the caller's own rows;
  error logs and background jobs are administrator-only. Rows without a project are administrator-only.
  This narrows what `audit.view` returns; roles that relied on seeing the whole log now need a platform
  administrator role.
- **Attachment events (TM-012).** Upload, update, delete and download each write an audit log row.
- **Container logs.** `compose.prod.yml` rotates each service's log (20 MB x 10 files). That keeps the disk
  safe; it is not a retained record. Ship container logs to a central collector with its own retention.
- **Existing rows.** Rows written before this change have no `project_id`, so they are administrator-only.
  They are not backfilled; backfill is a data decision for the operator.

# Follow-up: show and department narrowing (TM-002, part 2)

- **Show.** Episodes, sequences, shots and assets can be assigned to a show (`show`, nullable). A member
  bound to a show sees only records of that show and what hangs off them; unassigned records are hidden
  from them. Run `manage.py assign_shows --project CODE --show CODE [--dry-run]` to assign existing
  records; without it a show-bound member sees nothing until records are assigned.
- **Department.** A membership that names a department sees that department's tasks and what they reach.
  Match is by `department` text (case-insensitive) or `department_id`, so the values on memberships and
  tasks must agree. Check them before relying on this: memberships seeded with a mock `department_id` that
  matches no task will see nothing.
- **Whole-project views** (statistics, dashboards, deliveries, publishing, schedules, audit rows of the
  project) are withheld from narrowed members, as for external members.
- **API.** `show_id` is accepted on create and update of episodes, sequences, shots and assets, and
  reported in responses. Only administrators, full project members and show-bound members (own show
  only) may set it.

## Correction: the object-store bucket

An earlier summary said the public-read setting on the MinIO `media` bucket had been removed. It had
not. `create-buckets.sh` now sets the bucket private (`mc anonymous set none`).

The MinIO images the compose files use (`quay.io/minio/minio`, `quay.io/minio/mc`) can no longer be
resolved without credentials, so they cannot be pinned and a fresh `docker compose up` may be unable to
pull them. The application does not use the object store (no storage backend is configured), so the
service, its credentials and its bucket script are candidates for removal; that is a deployment decision
and was not made here.
