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

`DELIVERY_SECRET_KEY` (a Fernet key, different from the MFA one) is not checked, but without it setting or reading a delivery passcode answers 503.

The compose template `infrastructure/compose/.env.example` carries every variable above. (Until this checklist was written it lacked `MFA_ENCRYPTION_KEY`, `MFA_ENCRYPTION_ENABLED`, `DELIVERY_SECRET_KEY`, `API_KEY_PEPPER` and `API_KEY_ACCEPT_LEGACY_HASH`, so a deployment made from it failed this check on the first two errors.) Copy it to `infrastructure/compose/.env`, replace every `CHANGE_ME` (the Django secret key among them), and fill the three empty secrets (`MFA_ENCRYPTION_KEY`, `DELIVERY_SECRET_KEY`, `API_KEY_PEPPER`).

## 2. Database

- **New environment:** [`../setup/BOOTSTRAP.md`](../setup/BOOTSTRAP.md): `manage.py bootstrap` migrates, seeds the reference data and creates the first superuser. Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` (outside `local` and `testing` they are required). The account must change its password and enrol MFA at its first login.
- **Existing environment (from 4.0.0 to 4.1.0):** back the database up, then `manage.py migrate`. Seven migrations are new; `masterdata.0002` fills team memberships from each person's primary team and `settings.0002` makes the earliest active theme and localization the defaults. Try it on a restored copy first when the data matters ([`migration-guide.md`](migration-guide.md)).
- `manage.py makemigrations --check` must report no changes.

## 3. After it is up

- `GET /health/` answers.
- Sign in as the administrator and complete the password change and MFA enrolment; sign in again.
- With two other roles (for example an artist and a production admin), open a project: the artist sees only what the role allows.
- The Themes and Localizations screens show one default each; the app looks and formats as that default says.
- `manage.py check --deploy` is still clean inside the running container.

## 4. What was checked while writing this

The shipped compose template was run through `check --deploy` under the production settings (without the real `.env.production`): as shipped it fails with `core.E002`, `identity.E001` and `identity.E002` (the placeholders and the empty secrets, as it should), and once those are filled with generated values it exits 0 with only the OpenAPI warnings. Nothing here was run against a real deployment.
