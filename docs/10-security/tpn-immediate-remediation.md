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
