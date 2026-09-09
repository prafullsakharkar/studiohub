# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

StudioHub is an enterprise VFX/Animation/Game-Dev production management platform. It is a monorepo with two independently-run pieces:

- `backend/` — Django 6 + DRF modular monolith (Python 3.14, managed with `uv`).
- `frontend/` — React 19 + TypeScript + Vite SPA (originally generated in Google AI Studio, now evolving independently).

**Important:** the frontend is far ahead of the backend in scope. It ships its own MSW mock server (`frontend/src/mocks/`) and talks to those mocks by default instead of the real Django API — see "Frontend/backend integration status" below before assuming an endpoint exists.

## Common commands

### Backend (run from `backend/`, via `uv` or the `.venv`)

```bash
uv sync                                   # install/sync dependencies
uv run pytest                             # run full test suite
uv run pytest apps/identity               # run one app's tests
uv run pytest apps/identity/tests/test_x.py::TestClass::test_method  # single test
uv run ruff check .                       # lint
uv run ruff format .                      # format
uv run basedpyright                       # type check
uv run python manage.py migrate
uv run python manage.py makemigrations
uv run python manage.py shell_plus
```

Pytest is configured via `pyproject.toml`: settings module `config.settings.testing`, `--reuse-db`, coverage on `apps`, test discovery under `apps/**/tests`.

### Backend (via Docker, using the Makefile from repo root)

```bash
make build / make up / make down / make logs / make shell   # container lifecycle
make migrate / make makemigrations / make createsuperuser / make dbshell
make test           # pytest inside the django container
make pytest         # pytest -vv inside the django container
make lint           # ruff check
make format         # ruff format
make typecheck      # basedpyright
make check          # ruff check + basedpyright
```

Docker compose files live in `infrastructure/compose/` (`compose.yml` + `compose.dev.yml`/`compose.prod.yml`/`compose.test.yml` overlays). Services: postgres, redis, minio, mailpit, django, nginx, celery, celery-beat, flower.

### Frontend (run from `frontend/`)

```bash
npm install
npm run dev       # vite dev server on :3000
npm run build
npm run preview
npm run lint       # tsc --noEmit (no separate test runner is configured)
```

## Backend architecture

Modular monolith with one Django app per business domain under `backend/apps/`. Currently implemented: `core`, `identity`, `organization`, `settings`, `audit`. (Docs describe a planned `production` domain — asset/shot/task/version/review — that does not exist as backend code yet; don't assume its models/services are implemented.)

Every domain app follows the same internal layout, and layers are one-directional — never skip a layer or reach into another domain's internals:

```
apps/<domain>/
├── api/            # DRF views/urls — thin, delegate to services
├── serializers/
├── services/        # business logic, orchestration, transactions, events
├── selectors/        # all read queries (never write)
├── managers/ + querysets/   # ORM primitives
├── models/
├── validators/       # business-rule validation, called from services
├── events/            # domain events owned by this app
├── permissions/
├── choices/, constants/, types/, exceptions/, signals/, tasks/, admin/, migrations/, tests/
```

Request flow: `APIView → Serializer → Service → Validator/Selector → Manager/QuerySet → Model → DB`.

Key rules (see `docs/02-architecture/`):
- **`apps/core`** owns only generic, domain-agnostic infrastructure (`BaseService`, `CRUDService`, `AuditService`, `LifecycleService`, `EventService`, `CacheService`, `SoftDeleteService`, `BaseSelector`, event bus/dispatcher/registry, base models, permissions, pagination, etc.). Domain-specific logic must live in the owning app, never in `core`.
- **Services** contain business logic; they call validators before writes and selectors before reads, wrap multi-record mutations in explicit `transaction.atomic()` at the use-case boundary, and publish domain events after success. Prefer composing focused services (`CRUDService`, `LifecycleService`, ...) over the deprecated `BusinessService` god-class.
- **Selectors** are read-only, one per business entity, and are the place to add query optimization (`select_related`/`prefetch_related`) or read caching. They must never write.
- **Events**: `apps/core/events/` owns the event infrastructure (base `DomainEvent`, `EventBus`, dispatcher, registry, handlers). Concrete domain events (e.g. `ProjectCreatedEvent`) are defined in the owning domain app's `events/` package, never in core. Events needing committed DB state must publish with `on_commit=True`.
- API URLs are versioned and aggregated: each app owns `api/urls.py`; `config/v1_urls.py` mounts every domain under `v1` (e.g. `apps.identity.api.urls` → `api:v1:identity:...`); `config/api_urls.py` mounts `v1` under `api/`.
- Settings are environment-driven through `pydantic-settings` in `config/env.py` — this is the **only** module that should read env vars directly; everything else imports the resolved `settings` object. `DJANGO_ENV` selects both the settings module (`config/settings/{local,docker,testing,production,ci}.py`) and the `.env.*` file to load.

## Frontend architecture

Feature-oriented modules under `frontend/src/modules/<domain>/` (e.g. `auth`, `organization`, `production`, `shots`, `assets`, `tasks`, `versions`, `reviews`, `platform`, `audit`, `settings`, `dashboard`), each typically containing `components/`, `hooks/`, `pages/`, `repositories/`, `services/`. Cross-module reusable pieces live in `frontend/src/shared/` (data tables, CRUD scaffolding, entity relationship widgets, workspace/inspector UI) and `frontend/src/core/` (auth, org context, permissions/RBAC, workspace state).

Layering (see `frontend/docs/frontend/ARCHITECTURE.md`):
```
Presentation   — module pages/components, InspectorDrawer, DataTables
Application    — TanStack Query hooks, domain hooks, Zustand UI stores
Domain         — entities/value objects, RBAC permission matrix
Infrastructure — ApiClient (ky-based), MSW mocks, error mappers, serializers
```

- Server state: TanStack Query only. Client UI state: Zustand stores (`shared/stores/`). Cross-cutting app state: React Context (`AuthContext`, `OrganizationContext`).
- Multi-tenancy: every request is scoped by `activeOrganizationId`, sent as the `X-Organization-Id` header (see `frontend/src/api/client/ApiClient.ts`); switching orgs must not leak cached data across tenants.
- Permissions are enforced declaratively via `Can`/`HasPermission`/`HasRole`/`ProtectedComponent` (`core/permissions/`) plus route guards (`routes/ProtectedRoute.tsx`).
- Path alias `@/*` maps to `frontend/src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

### Frontend/backend integration status

`ApiClient` (`frontend/src/api/client/ApiClient.ts`) routes requests through `dispatchMockRequest` (`frontend/src/mocks/mockRouter.ts`), backed by MSW handlers in `frontend/src/mocks/handlers/*` and an in-memory mock DB in `frontend/src/mocks/db/*`. Most modules (production, shots, assets, tasks, versions, reviews, playlists, scheduling, intelligence, etc.) only exist as frontend mock data today — there is no corresponding backend app for them yet. When asked to "wire up" a feature end-to-end, check whether the backend domain app actually exists under `backend/apps/` before assuming the API is real.

## Documentation

`docs/` is extensive and is treated as part of the codebase (kept in sync with implementation per `docs/README.md`). Notable but currently **empty stub files** (don't rely on them): `docs/01-getting-started/{installation,quick-start,development,...}.md`. Prefer `docs/02-architecture/*` and `docs/adr/*` for backend design rules, and `frontend/docs/frontend/*` for frontend design rules — these are populated and authoritative.
