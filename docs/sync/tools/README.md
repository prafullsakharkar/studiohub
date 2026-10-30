# docs/sync tools

Phase 0 discovery scripts. They read the code; none of them changes backend or frontend files. Run from `backend/` through `uv run` (never system Python). `S` is any scratch directory.

| Script | Produces | Run |
|---|---|---|
| `urls_dump.py` | every URL pattern with view, actions, permission classes | `DJANGO_ENV=testing uv run python ../docs/sync/tools/urls_dump.py $S/urls.json` (no DB access) |
| `views_meta.py` | per-view permission maps, pagination, filters, search, ordering | `DJANGO_ENV=testing uv run python ../docs/sync/tools/views_meta.py $S/views_meta.json` |
| `models_dump.py` | model fields, relations, choices, soft-delete flags | `DJANGO_ENV=testing uv run python ../docs/sync/tools/models_dump.py $S/models.md` |
| `perm_catalog.py` | seeded catalog vs codes enforced by views | `DJANGO_ENV=testing uv run python ../docs/sync/tools/perm_catalog.py $S/views_meta.json $S/perms.json` |
| `audit_filters.py` | filter fields of every audit viewset | `DJANGO_ENV=testing uv run python ../docs/sync/tools/audit_filters.py` |
| `test_capture_samples.py` | `docs/sync/samples/**` (real responses) | see below |
| `fe_calls.py`, `fe_literals.py`, `coverage.py` | frontend call sites, URL literals, backend-route coverage | `python3 -I ../docs/sync/tools/fe_literals.py ../frontend/src $S/routes.tsv $S/fe_literals.json` |
| `gen_inventory.py` | the generated part of `00-backend-inventory.md` (`_generated_endpoints_models.md`) and `00b-backend-serializers.md` | `uv run python -I ../docs/sync/tools/gen_inventory.py $S ../docs/sync` |

`routes.tsv` comes from `python3 -I ../docs/sync/tools/routes_tsv.py $S/urls.json $S/routes.tsv`; `schema.yaml` comes from `uv run python manage.py spectacular --file $S/schema.yaml`.

## Phase 1 additions

| Script | Produces | Notes |
|---|---|---|
| `test_capture_auth_flows.py` | `samples/identity/_auth_mfa_flow.json`, `_auth_password_reset_flow.json` | real MFA login (TOTP, recovery code, wrong/garbage challenge) and password reset; same pytest-test-database rules as below |
| `test_capture_departments_flow.py` | `samples/masterdata/_departments_flow.json` | the departments list/create flow: search, ordering, filter, paging, duplicate errors, 403 for a non-manager |
| `test_capture_restricted_flow.py` | `samples/identity/_restricted_sessions_flow.json` | restricted sessions (MFA enrollment owed, password change owed) captured through the **real JWT auth chain**; `force_authenticate` skips this check |
| `live_backend.py` | a running Django for `pnpm test:live` | pytest-django `live_server` on the pytest test database; seeds users that each exercise a backend rule; see `phase-1-verification.md` §6 |
| `run_role_smoke.sh` | the Playwright role smoke (`frontend/e2e/live`) | starts `live_backend.py` (`SYNC_LIVE_MINUTES`, default 45, sets how long it serves), waits for the MFA seed step, runs the specs against it, stops it; state is kept in `frontend/test-results/live` |
| `unreachable.mjs` | the files under `frontend/src` that nothing reachable from `main.tsx` imports | run from `frontend/`: `node ../docs/sync/tools/unreachable.mjs . \| grep ^unreached`; tests are not roots, so a file only a test imports shows as unreachable |

Same invocation as below, e.g. `SYNC_SAMPLES_OUT=../docs/sync/samples uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q ../docs/sync/tools/test_capture_restricted_flow.py`. They do not need `routes.tsv`.

## Capturing samples

`test_capture_samples.py` is a pytest module that runs **only against the pytest test database** (it asserts the connected DB name is test-prefixed and runs inside one rolled-back transaction). Do not set `DJANGO_ENV` for this run: pytest must resolve the same test database as a normal `uv run pytest`.

```bash
cd backend
SYNC_SCRATCH=$S SYNC_SAMPLES_OUT=../docs/sync/samples \
  uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
  ../docs/sync/tools/test_capture_samples.py
```

It needs `$S/routes.tsv`. Responses are redacted (tokens, secrets, passwords, e-mails) and long strings truncated before they are written.
