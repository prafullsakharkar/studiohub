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

## Capturing samples

`test_capture_samples.py` is a pytest module that runs **only against the pytest test database** (it asserts the connected DB name is test-prefixed and runs inside one rolled-back transaction). Do not set `DJANGO_ENV` for this run: pytest must resolve the same test database as a normal `uv run pytest`.

```bash
cd backend
SYNC_SCRATCH=$S SYNC_SAMPLES_OUT=../docs/sync/samples \
  uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
  ../docs/sync/tools/test_capture_samples.py
```

It needs `$S/routes.tsv`. Responses are redacted (tokens, secrets, passwords, e-mails) and long strings truncated before they are written.
