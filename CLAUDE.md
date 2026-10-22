# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read first

`AGENTS.md` (repo root) and `backend/AGENTS.md` are the authoritative project rules; `backend/.ai/{ARCHITECTURE,PROJECT_RULES,CODING_GUIDELINES,DEVELOPMENT_WORKFLOW}.md` and `docs/adr/` back them up. Don't restate them here — read them before backend work. Priority when sources conflict: explicit user request → `AGENTS.md` → `backend/AGENTS.md` → `.ai/` docs → existing code/ADRs.

## Repository state (differs from what AGENTS.md describes)

`AGENTS.md` describes an organization-aware platform with a `frontend/` and an `apps/organization` reference implementation. **Neither exists in the runtime today:**

- The `frontend/` directory was removed (commit `d1bbd7a`). This repo is backend-only; the API contract it must preserve was defined by the former frontend's mock API (see `config/v1_urls.py` "frontend-compatible aliases").
- `apps/organization` is not in `INSTALLED_APPS` and has no tracked source (only untracked `__pycache__`/`.cover` leftovers). Treat the "use `apps/organization` as the reference" instruction as unavailable; use `apps/identity`, `apps/settings`, `apps/audit` for layout instead.
- Identity is **platform-global by decision** (`docs/adr/ADR-0034-identity-platform-global-boundary.md`): do not add organization FKs or org-scoped queries to `apps/identity`. Tenancy/isolation is enforced only where a real tenant dimension exists (e.g. `ProjectMembership` in `apps.production`).
- The `.cover` files and `__pycache__` dirs scattered under `apps/` are artifacts; ignore them.

Installed local apps (`config/settings/components/apps.py`): `core`, `identity`, `settings`, `audit`, `production`, `intelligence`, `deliveries`, `publishing`, `scheduling`, `masterdata`, `platform`.

## Commands

All backend commands run from `backend/` and **must** go through `uv run` (never system Python).

```bash
uv sync                                          # install deps
uv run python manage.py check
uv run python manage.py migrate
uv run python manage.py makemigrations
uv run pytest                                    # full suite (coverage gate fail_under=72)
uv run pytest apps/identity                      # one app
uv run pytest apps/identity/tests/services/test_rbac_services.py::TestClass::test_name   # single test
uv run ruff check . && uv run ruff format .
uv run basedpyright                              # type check (apps/, config/; migrations excluded)
```

- Test DB: the database comes from the env file (`DB_*`). That DB role has no `CREATEDB`, so `pytest --create-db` fails. `transaction=True` tests flush every table in the configured DB, and `manage.py test` (`PreserveDatabaseTestRunner`) runs directly against it, so check the DB holds nothing you need before using either.
- Pytest settings (`pyproject.toml`): `DJANGO_SETTINGS_MODULE=config.settings.testing`, `--reuse-db --strict-markers --import-mode=importlib --cov=apps`, tests discovered under `apps/**/tests`.
- CI (`.github/workflows/ci.yml`) runs `ruff check`, `manage.py check`, then pytest against Postgres 17 with `DJANGO_ENV=testing`. Run those same three before finishing.
- Docker workflow from repo root via `Makefile` (`make up|down|migrate|test|lint|check|shell`); compose files in `infrastructure/compose/` (`compose.yml` + `compose.dev|prod|test.yml`). `PROJECT_NAME` there is `vfx-platform`.

## Architecture

Modular monolith: one Django app per domain under `backend/apps/`, strictly layered, one direction only:

```
View/ViewSet → Serializer → Service → Validator / Selector → Manager / QuerySet → Model
```

- **Reads go through selectors; writes/business rules go through services.** Views and serializers stay thin. Services own `transaction.atomic()` at the use-case boundary, call validators before writes, and publish domain events afterward (use `on_commit=True` when handlers need committed state).
- **`apps/core`** is the generic shared kernel (base models, `CRUDService`/`LifecycleService`/`SoftDeleteService`/`AuditService`, `BaseSelector`, event bus, permissions, pagination, cache). It must never import business domains or hold domain logic (ADR-0026/0027). `BusinessService` in core is deprecated — compose focused services instead. Concrete domain events live in the owning app's `events/`, not core.
- Per-app packages follow the `identity` layout: `api/{viewsets,views,serializers,filtersets,routers,urls*.py}`, `services/`, `selectors/`, `managers/`, `querysets/`, `models/`, `validators/`, `events/`, `signals/`, `permissions/`, `tasks/`, `tests/`.
- **URLs:** each app owns `api/urls.py`; `config/v1_urls.py` mounts every domain under the `v1` namespace and `config/api_urls.py` mounts that at `api/`. Several routes are deliberately mounted at the top level or under compat aliases (`auth/`, `attachments/`, RBAC `roles|groups|permissions`, `activity/`) to match the former frontend's paths — don't "tidy" them without checking the contract.
- **Settings:** `config/env.py` (pydantic-settings) is the only module that reads env vars; `DJANGO_ENV` (default `local`) selects `config/settings/{local,docker,testing,production,ci}.py` and the `.env` file. Settings are split into `config/settings/components/*.py`.
- **Auth chain** (identity): `SessionBoundJWTAuthentication` → `PersonalAccessTokenAuthentication` → `APIKeyAuthentication`. Authorization model is defined in ADR-0033 / ADR-0017 / ADR-0032; RBAC is flat (Role/Permission/Group tables, no tenant column) with a permission resolver (`identity/resolvers/permission.py`) plus a cache invalidated by RBAC signals (`identity/signals/rbac.py`, `identity/services/permission_cache.py`) — changes to role/group membership must keep that invalidation correct.
- Production DB is PostgreSQL; SQLite may be used for dev/test only when configured. Keep ORM code database-portable.

## Active work: identity hardening

Branch `feature/identity-hardening` executes a phased plan: `docs/identity/AUDIT.md` (findings), `PLAN.md` (work packages, with status per phase), `CONTRACTS.md` (approved `API-*`/`SEC-*`/`DOM-*` contracts). Phases 1–5 are committed (Phase 4: RBAC in `services/rbac.py`; Phase 5: sessions, append-only ledgers, identity-owned login history, trusted-proxy client IP, devices); Phase 6 (MFA and recovery, TOTP secrets encrypted via `MFA_ENCRYPTION_KEY`, switchable off with `MFA_ENCRYPTION_ENABLED=false`) and Phase 7 (credential lifecycle API, scope enforcement, `API_KEY_PEPPER` digests; OAuth models removed) are implemented; both fail closed without their keys. In Phase 7 the user asked for targeted tests only, not the full suite. Changes to an `API-*` contract require updating `CONTRACTS.md`; changes to a `SEC-*`/`DOM-*` invariant that alter the trust model require an ADR. Reference work-package IDs (e.g. `WP 3.3`) in commits and tests.

## Docs

`docs/` is part of the deliverable — update `docs/adr/`, `docs/apps/`, `docs/api/`, `docs/identity/` alongside code. Many numbered directories (`01-getting-started`, etc.) contain empty stubs; prefer `docs/adr/*`, `docs/architecture/`, `docs/identity/`, and `backend/.ai/*`.
