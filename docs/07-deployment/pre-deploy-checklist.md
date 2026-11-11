# Pre-deploy checklist

What to do before a new environment (or a new release) takes traffic. It is short on purpose: `manage.py check --deploy` enforces most of it, so the first job is to make that command clean for the environment you are about to start. The general production design is in [`production.md`](production.md); rolling back is in [`rollback.md`](rollback.md).

## 1. Run the deploy check with the environment you will deploy

From `backend/`, with the production settings and the real environment loaded:

```bash
DJANGO_SETTINGS_MODULE=config.settings.production DJANGO_ENV=production uv run python manage.py check --deploy
```

It does not connect to the database. It must exit 0. Two things are expected and harmless: `drf_spectacular.W001` and `W002` warnings (about 175 of them; they concern the generated OpenAPI documents, not behaviour), and nothing else.

| Check | Stops the deploy when | Fix |
|---|---|---|
| `core.E002` | `DJANGO_SECRET_KEY` is short or a placeholder | `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `identity.E001` | `MFA_ENCRYPTION_KEY` is empty or not a Fernet key (MFA fails closed) | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `core.E005` | `MFA_ENCRYPTION_ENABLED=false` (TOTP secrets in plaintext) | set it to `true`; on an existing database then run `manage.py mfa_encrypt_secrets` |
| `identity.E002` | `API_KEY_PEPPER` is empty (API keys and tokens cannot be made or checked) | `python -c "import secrets; print(secrets.token_urlsafe(48))"`; changing it later invalidates every stored credential |
| `core.E001` | a Redis URL for the cache, the broker or the result backend has no password | `redis://:<password>@host:port/db`, and `requirepass` on Redis |
| `core.E003` | mail goes over SMTP without TLS, or `EMAIL_USE_TLS` and `EMAIL_USE_SSL` are both on | `EMAIL_USE_TLS=true` with port 587, or `EMAIL_USE_SSL=true` with 465 |
| `core.E004` | `FRONTEND_BASE_URL` is not `https://…` (reset emails would carry no usable link) | the web client's https address |
| `core.E006`, `core.E007` | the database or Redis link is not verified or not encrypted, with `INTERNAL_TLS_REQUIRED=true` (warnings `W006`/`W007` without it) | `DB_SSLMODE=verify-full` and `DB_SSLROOTCERT`; `REDIS_TLS=true`, `rediss://` URLs, `REDIS_CA_CERT` |
| `core.W001`, `core.W002` | the Django admin or the API docs are on | `ADMIN_ENABLED=false`, `API_DOCS_ENABLED=false` |
| `core.W003` | `DEFAULT_FROM_EMAIL` is the development placeholder | an address the relay may send as |
| `core.W004` | `TRUSTED_PROXY_IPS` is empty (client IPs in logs, throttles and blocks would be the proxy's) | the proxy's address or network |
| `core.W005` | `API_KEY_ACCEPT_LEGACY_HASH=true` | `false` in a new environment; true only while carrying old credentials over (`manage.py legacy_credentials`) |

**When MFA answers 503 "temporarily unavailable"** the response is deliberately generic; the server log (logger `apps.core.security.fernet`, level WARNING) names the cause as a reason code: `no_key` and `malformed_key` (fix `MFA_ENCRYPTION_KEY`), `plaintext_at_rest` (a secret saved while encryption was off: run `manage.py mfa_encrypt_secrets`), `undecryptable` (made under another key, or altered: put the old key back in the key list, then `manage.py mfa_rekey`). The log carries the code and the setting name only, never a value or a key. The same applies to the delivery passcode (`DELIVERY_SECRET_KEYS`).

`DELIVERY_SECRET_KEY` (a Fernet key, different from the MFA one) is not checked, but without it setting or reading a delivery passcode answers 503.

`DIRECTORY_ENCRYPTION_KEY` (another Fernet key) protects the directory (LDAP) service account's password (ADR-0039). It is only needed where directory sign-in is used: without it the password cannot be saved on Settings -> System -> Directory (LDAP) (503) and directory sign-in stays off; local accounts are unaffected. `DIRECTORY_LOGIN_FORCE_OFF=true` turns directory sign-in off whatever the screen says. Run `manage.py ldap_sync` on a schedule (it deactivates accounts whose entry is gone and changes nothing when the directory is down).

The compose template `infrastructure/compose/.env.example` carries every variable above. (Until this checklist was written it lacked `MFA_ENCRYPTION_KEY`, `MFA_ENCRYPTION_ENABLED`, `DELIVERY_SECRET_KEY`, `API_KEY_PEPPER` and `API_KEY_ACCEPT_LEGACY_HASH`, so a deployment made from it failed this check on the first two errors.) Copy it to `infrastructure/compose/.env`, replace every `CHANGE_ME` (the Django secret key among them), and fill the three empty secrets (`MFA_ENCRYPTION_KEY`, `DELIVERY_SECRET_KEY`, `API_KEY_PEPPER`).

## 2. Database

- **New environment:** [`../setup/BOOTSTRAP.md`](../setup/BOOTSTRAP.md): `manage.py bootstrap` migrates, seeds the reference data and creates the first superuser. Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` (outside `local` and `testing` they are required). The account must change its password and enrol MFA at its first login.
- **Existing environment (from 4.0.0 to 4.1.0):** back the database up, then `manage.py migrate`. Seven migrations are new; `masterdata.0002` fills team memberships from each person's primary team and `settings.0002` makes the earliest active theme and localization the defaults. Try it on a restored copy first when the data matters ([`migration-guide.md`](migration-guide.md)).
- **From 4.1.x to 4.2.0:** two new migrations, both in `identity` and both additive (no existing row changes): `0003_directory_sign_in` (CR-40: the directory configuration and account-link tables, `User.mfa_required`, new login-attempt reasons) and `0004_directory_tls_options` (CR-41: two columns on the directory configuration, both off or empty). CR-42 (vendor ids) and CR-43 (project list queries) need no migration.
- **Behaviour change in 4.2.0 (CR-42):** a project's `vendor_ids` must now be live vendor UUIDs, each listed once, or the write is a `400`; `vendor_names` is read-only (computed from the vendors; a client that sends it is ignored). Rows that already hold other ids are read as they are; the next write of `vendor_ids` must be valid. A deleted vendor's id stays on the projects that list it until someone removes it.
- **From 4.2.x to 4.3.0:** no new migration (`makemigrations --check` reports no changes); deploy the code. **Behaviour change (CR-45):** `POST /api/v1/people/{id}/link-user/` accepts an optional `move` (default `false`: unchanged). With `move: true` the person that has the login is unlinked and loses its e-mail, then the login is linked to the requested person; both are audited. CR-44 (nine list endpoints join their related records) changes no response.
- **From 4.3.x to 4.4.0:** no new migration (`makemigrations --check` reports no changes); deploy the code. Four **behaviour changes**, each a written change request (`docs/sync/backend-change-requests.md`):
  - **CR-46 (security):** the bulk routes (`bulk-update`, `bulk-archive`, `bulk-restore`, `bulk-create` with `action: recover`, `check-existence`) now find rows through the same narrowing as the single routes. A member bound to a show, one limited to a department, and an external (vendor/client) member get `not_found` for rows a single `PATCH` already hid from them; before, the bulk route changed them. `check-existence` no longer returns `existing_entity` for a row the caller cannot see.
  - **CR-47:** episodes exist only on episodic projects. A standard project's episodes (left by seeds or older data) are no longer served: detail, update, archive and the bulk routes answer 404 / `not_found` and its list is empty; creating one is still a 400. Nothing is deleted; `report_production_data` lists them.
  - **CR-48 (additive):** `bulk-create` and `bulk-update` accept `dry_run` and `atomic`; bulk update matches a row by `id` or by `code` within `project_id`; more than **500 items** in one request is a 400; a writable field outside the entity's bulk-update list refuses that row (`This field cannot be changed in bulk.`); every response carries `errors: [{row, field, message}]`; one `AuditLog` row per committed batch. Without the flags the routes behave as before.
  - **CR-49 (breaking for API clients, D-43):** a NEW episode, sequence, shot, asset or task must have a code that starts with its project's code (`TST_SQ0010` in project `TST`), single or bulk, and a NEW shot must name a sequence of its project; otherwise **400** (`Codes in project TST start with TST_.` / `A shot needs a sequence.`; in bulk the row is `invalid`). Server-made codes carry the prefix too (a blank episode is `TST_EP101`; `code_prefix` numbering gives `TST_SH0010`). Create only: existing records, update, `rename-code`, bulk update by code, recovery and versions are unchanged, and records made by services (task templates, seeds) are not checked. **Before deploying**, update any script, importer or integration that creates these records, and run `manage.py report_production_data`: its information sections show how many live records already have the prefix and which shots have no sequence (shots made by the old Bulk add shots screen lost theirs; edit them and pick a sequence).
- **From 4.4.0 to 4.4.1:** no migration and no backend change; deploy the frontend. Two fixes in Bulk add: pasting into the *Bulk add shots* grid with the grid's own column labels (`Shot Code`, `Sequence`) no longer loses the code and the sequence, and the result line now shows how many rows were updated.
- **From 4.4.1 to 4.4.2:** no migration. A backend change that is additive (CR-50): `GET /api/v1/shots/` accepts an optional `has_sequence=false|true`, and the Shots list has a *Sequences* filter. Deploy the backend and the frontend together. Also in the frontend: *Bulk add shots* is offered only with `shot.create` (it was shown to people the server refuses), and the Bulk add toasts say "1 sequence". **After deploying**, run `manage.py report_production_data`; if it lists shots without a sequence, fix them from the Shots list (*Sequences > Without a sequence*, tick, *Edit fields*, *Sequence*).
- **From 4.4.2 to 4.4.3:** no migration. Dependency and image updates only; **rebuild the images** (the Django image has a new base digest and now names `zlib1g` so apt installs Debian's fixed 1.3.1-1+deb13u1; the nginx and redis pins and the dev mailpit pin moved to newer digests). Backend: Django 6.1.3, pydantic 2.14.3 and pydantic-core 2.50.4, kombu 5.7.0 (was 5.7.0rc1), amqp 5.4.2, billiard 4.3.2, click-repl 0.4.1, markdown 3.11.3; dev tools ruff 0.17.4, ipython 9.18.1, djangorestframework-stubs 3.18.2. Frontend: vite 8.3.6, vitest 5.1.0, `@vitejs/plugin-react` 6.2.1, jsdom 31, tailwindcss 4.3.5, TanStack Query 5.107.1 and a dozen smaller bumps. **Not taken:** Celery 5.7.0, because it pins `python-dateutil==2.9.0.post0` (a downgrade from 3.0.0, which Celery 5.6.3 does not need); Python 3.15 for the image, because CI runs the backend on 3.13 and nothing tests 3.15.
- **From 4.4.3 to 4.4.4:** Celery 5.7.0. No migration, no API change. **Rebuild the image and restart the workers and beat together** (a 5.6 worker and a 5.7 producer share one Redis, so do not run them side by side for long). Celery moves 5.6.3 to 5.7.0 and `python-dateutil` moves 3.0.0 to 2.9.0.post0, which Celery 5.7.0 pins (the code does not import dateutil; croniter and Celery are its only users, and the `tzdata` package dateutil 3.0 had added is gone; the `python:3.14-slim` image carries `/usr/share/zoneinfo`, which Python and Django use). Settings are unchanged. Checked against a worker with beat on a private Redis: delay and result, chain, chord, retry with backoff, exhausted retries, `ignore_result`, countdown, beat firing. **Also fixed (not caused by this change):** `BaseTask.on_retry` and `on_failure` (`apps/core/tasks/base.py`) passed `args` and `kwargs` in logging's `extra`, reserved keys, so they raised `KeyError` on Celery 5.6.3 and 5.7.0 alike; they now log `task_args` and `task_kwargs`. No task in `apps/` uses `BaseTask` today, so nothing was affected.
- `manage.py makemigrations --check` must report no changes.

### PostgreSQL 17 to 18 (compose deployments)

The `postgres` image is now 18 (`infrastructure/docker/postgres/Dockerfile`), and CI tests against 18. PostgreSQL 18 images keep the cluster under `/var/lib/postgresql/18/docker`, so `compose.yml` mounts `postgres_data` at `/var/lib/postgresql` (it was `/var/lib/postgresql/data`). A 17 cluster cannot be opened by 18, and files left in the old layout are not used. A new environment needs nothing. An existing one moves by dump and restore:

```bash
# with the OLD image still running
docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner > studiohub-pg17.sql
docker compose down
docker volume rm vfx-platform_postgres_data      # only after the dump is checked
git pull && docker compose up -d --build postgres   # a fresh 18 cluster
docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" < studiohub-pg17.sql
docker compose up -d
```

Take the dump with the variables from `.env`; check it is not empty before removing the volume. The test database already ran 18.6. Verified for this change: the image builds, a fresh volume initialises as 18.6 with `pg_trgm` and `unaccent` from `init.sql`, `btree_gist` 1.8 installs, and `healthcheck.sh` passes. The dump and restore above were **not** run against a real deployment.

## 3. After it is up

- `GET /health/` answers.
- Sign in as the administrator and complete the password change and MFA enrolment; sign in again.
- With two other roles (for example an artist and a production admin), open a project: the artist sees only what the role allows.
- The Themes and Localizations screens show one default each; the app looks and formats as that default says.
- `manage.py check --deploy` is still clean inside the running container.

## 4. What was checked while writing this

The shipped compose template was run through `check --deploy` under the production settings (without the real `.env.production`): as shipped it fails with `core.E002`, `identity.E001` and `identity.E002` (the placeholders and the empty secrets, as it should), and once those are filled with generated values it exits 0 with only the OpenAPI warnings. Nothing here was run against a real deployment.
