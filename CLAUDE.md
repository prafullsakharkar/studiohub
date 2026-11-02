# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read first

`AGENTS.md` (repo root) and `backend/AGENTS.md` are the authoritative project rules; `backend/.ai/{ARCHITECTURE,PROJECT_RULES,CODING_GUIDELINES,DEVELOPMENT_WORKFLOW}.md` and `docs/adr/` back them up. Don't restate them here — read them before backend work. Priority when sources conflict: explicit user request → `AGENTS.md` → `backend/AGENTS.md` → `.ai/` docs → existing code/ADRs.

## Repository state (differs from what AGENTS.md describes)

`AGENTS.md` describes an organization-aware platform with a `frontend/` and an `apps/organization` reference implementation. **`apps/organization` does not exist in the runtime today, and `frontend/` is a different codebase from the one `AGENTS.md` describes:**

- `frontend/` is the React app (React 19, Vite, TypeScript, pnpm; see `frontend/CLAUDE.md`, `frontend/AGENTS.md`). It was synced from the sibling `studiohub-react` repo with its mock layer removed and then made a faithful client of this backend, phase by phase (Phases 0 to 23, `docs/sync/`; start at `docs/sync/README.md`). It has its own tooling (`pnpm dev|build|test|typecheck` from `frontend/`) and is not wired into `Makefile` or the compose files; CI has a `frontend` job (below). The API contract the backend must preserve is the frontend's typed API (`frontend/src/api/<app>/`, pinned to responses captured from this backend in `docs/sync/samples/`; see also `config/v1_urls.py` "frontend-compatible aliases"). Keep `frontend/.env` out of Git (ignored).
- `apps/organization` is gone (no source, not in `INSTALLED_APPS`; the leftover directory was deleted). Treat the "use `apps/organization` as the reference" instruction as unavailable; use `apps/identity`, `apps/settings`, `apps/audit` for layout instead.
- Identity is **platform-global by decision** (`docs/adr/ADR-0034-identity-platform-global-boundary.md`): do not add organization FKs or org-scoped queries to `apps/identity`. Tenancy/isolation is enforced only where a real tenant dimension exists (e.g. `ProjectMembership` in `apps.production`).
- The `.cover` files and `__pycache__` dirs scattered under `apps/` are artifacts; ignore them.

Installed local apps (`config/settings/components/apps.py`): `core`, `identity`, `settings`, `audit`, `production`, `deliveries`, `publishing`, `scheduling`, `masterdata`. The former `intelligence` app (knowledge, search, AI and analytics endpoints, `/api/v1/intelligence/*`) and the former `platform` app (notifications/reports endpoints and models) were removed; its `SettingsPermissions` and `PlatformMasterDataPermissions` constants now live in `apps/settings/constants/permissions.py` and `apps/masterdata/constants/permissions.py`.

## Commands

All backend commands run from `backend/` and **must** go through `uv run` (never system Python).

```bash
uv sync                                          # install deps
uv run python manage.py check
uv run python manage.py migrate
uv run python manage.py makemigrations
uv run pytest                                    # all tests, no coverage (faster)
uv run pytest --cov=apps                         # as CI runs it (coverage gate fail_under=72)
uv run python manage.py bootstrap                # new database: migrate, seed reference data, create the superuser
scripts/reset_and_bootstrap.sh <database-name>   # wipe a dev/test database and run bootstrap (docs/setup/BOOTSTRAP.md)
uv run pytest apps/identity                      # one app
uv run pytest apps/identity/tests/services/test_rbac_services.py::TestClass::test_name   # single test
uv run ruff check . && uv run ruff format .
uv run basedpyright                              # type check (apps/, config/; migrations excluded)
```

- Test DB: the database comes from the env file (`DB_*`). That DB role has no `CREATEDB`, so `pytest --create-db` fails. `transaction=True` tests flush every table in the configured DB, and `manage.py test` (`PreserveDatabaseTestRunner`) runs directly against it, so check the DB holds nothing you need before using either.
- Pytest settings (`pyproject.toml`): `DJANGO_SETTINGS_MODULE=config.settings.testing`, `--reuse-db --strict-markers --import-mode=importlib --cov=apps`, tests discovered under `apps/**/tests`.
- CI (`.github/workflows/ci.yml`) runs `ruff check`, `manage.py check`, then pytest against Postgres 17 with `DJANGO_ENV=testing`. Run those same three before finishing.
- CI also runs a `frontend` job (Node 24, pnpm 10.12.1, from `frontend/`): `pnpm typecheck`, `pnpm exec biome check src --diagnostic-level=error`, `pnpm test`, `pnpm build`. The tests need no backend (every mock is a captured response); the browser role smoke and the live vitest files need a seeded backend and stay manual (`docs/sync/tools/run_role_smoke.sh`).
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

## Frontend sync (docs/sync)

Rules that held for every phase and still apply to work on `frontend/`:
- **The backend is the contract.** No endpoint, field or error shape is used unless it was read from this backend's code or captured from a real response. Verify a claim about backend behaviour against the running backend (the throwaway harness, below), not from memory.
- **No backend change without approval.** Write a change request first in `docs/sync/backend-change-requests.md` (problem, evidence, minimal diff, why no frontend workaround), then wait. The latest, **CR-37** (edit and remove a project member by id, set a department; after CR-36, which binds a member to a show), is applied (`docs/sync/backend-cr-37-verification.md`).
- One branch per phase (`sync/phase-N-<name>`); stop after each with a report in `docs/sync/phase-N-verification.md`; merge into `develop` and push only when asked, `main` only when asked (merge and push are separate requests). Remove dead code in its own commit and list it in the report.
- Gates from `frontend/`: `pnpm typecheck && pnpm test && pnpm build`; `pnpm exec biome check src` (baseline 0 errors); `node ../docs/sync/tools/unreachable.mjs . | grep ^unreached` (only tests, `*RowKeys.ts` and helpers). `tsc` excludes tests: check type-level assertions in a compiled module. Mutation-check the tests that matter (break the code, expect a failure).
- Against a live backend (a throwaway factory-seeded one on the pytest test database, never the development database): `docs/sync/tools/run_role_smoke.sh [--vitest <file> | --grep "<role>"]`, one run at a time. A killed run leaves seeded users behind: run one small transactional backend test (e.g. `apps/identity/tests/services/test_rbac_concurrency.py`) to flush. The browser smoke can show a blank page when the host's network changes (`net::ERR_NETWORK_CHANGED`); the spec reloads and logs it.
- Targeted backend tests only unless asked: never `manage.py test`, never `git stash`.

## Active work: identity hardening

Branch `feature/identity-hardening` executes a phased plan: `docs/identity/AUDIT.md` (findings), `PLAN.md` (work packages, with status per phase), `CONTRACTS.md` (approved `API-*`/`SEC-*`/`DOM-*` contracts). Phases 1–5 are committed (Phase 4: RBAC in `services/rbac.py`; Phase 5: sessions, append-only ledgers, identity-owned login history, trusted-proxy client IP, devices); Phase 6 (MFA and recovery, TOTP secrets encrypted via `MFA_ENCRYPTION_KEY`, switchable off with `MFA_ENCRYPTION_ENABLED=false`) and Phase 7 (credential lifecycle API, scope enforcement, `API_KEY_PEPPER` digests; OAuth models removed) are implemented; both fail closed without their keys. In Phase 7 the user asked for targeted tests only, not the full suite. Changes to an `API-*` contract require updating `CONTRACTS.md`; changes to a `SEC-*`/`DOM-*` invariant that alter the trust model require an ADR. Reference work-package IDs (e.g. `WP 3.3`) in commits and tests.

## Docs

`docs/` is part of the deliverable — update `docs/adr/`, `docs/apps/`, `docs/api/`, `docs/identity/` alongside code. Many numbered directories (`01-getting-started`, etc.) contain empty stubs; prefer `docs/adr/*`, `docs/architecture/`, `docs/identity/`, and `backend/.ai/*`.
