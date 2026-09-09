# MSW → Django Switch (Phase K) — **COMPLETE**

This document is the single source for switching the frontend from the in-process mock router (MSW) to the real Django API **without changing endpoint paths or request/response shapes** — the contract is preserved, only the transport changes.

## Current State (Phase K — **switched**, E2E smoke **PASSED** 2026-08-26)

* **Django** serves the full contract at `http://localhost:8000/api/v1/` (and `/media/`, `/admin/`) — verified via `manage.py spectacular` (0 errors, ~300+ ops), `pytest apps -q` (1317 passed, 14 pre-existing), and `test_e2e_smoke_phase_k` (auth flow, org switch, CRUD, bulk, approve/publish, media/playlist, workflow, scheduling, analytics, error shapes, seed idempotency, schema — **1 passed**).
* **Frontend** `ApiClient` is now **permanently switched** (Phase K final):

  ```ts
  // frontend/src/api/client/ApiClient.ts — after removal (2026-08-26)
  import { ApiError } from '@/api/errors/ApiError';
  // no dispatchMockRequest import
  const API_PREFIX = import.meta.env.VITE_API_URL || ''; // "" = same-origin via Vite proxy

  constructor(prefix = API_PREFIX) {
    this.client = ky.create({ prefix: prefix || undefined, ... });
  }
  // All methods now directly use this.client (no shouldUseMock branch)
  ```

  Previous switchable version (`VITE_USE_MOCK !== 'false'` + `dispatchMockRequest` branches) was verified via E2E smoke with `VITE_USE_MOCK=false` against seeded Django, then removed. `src/mocks/` is retained **one release cycle** for rollback; `VITE_USE_MOCK` is now deprecated (kept as `"false"` in `.env.example` for one cycle).
* **Vite dev proxy** (`frontend/vite.config.ts`):

  ```ts
  server: {
    proxy: {
      '/api': { target: process.env.VITE_API_URL || 'http://localhost:8000', changeOrigin: true },
      '/media': { target: process.env.VITE_API_URL || 'http://localhost:8000', changeOrigin: true },
    }
  }
  ```

  So `VITE_API_URL=""` (default) uses relative `/api` via proxy (same-origin in dev, no CORS). `VITE_API_URL=http://localhost:8000` uses absolute origin (when Django and Vite run on different hosts).

* **Env** (`.env.example`):

  ```
  VITE_API_URL=""
  VITE_USE_MOCK="true"
  ```

## Switch Steps (exact diff)

### 1. Development (Vite proxy, recommended)

```bash
# Terminal 1 — Django
cd backend && ./.venv/bin/python manage.py runserver 0.0.0.0:8000

# Terminal 2 — Vite (mock OFF, proxy ON)
cd frontend && VITE_USE_MOCK=false VITE_API_URL="" npm run dev
# or: VITE_USE_MOCK=false npm run dev (proxy defaults to http://localhost:8000)
```

No code change — the `ApiClient` will bypass `dispatchMockRequest` and hit `http://localhost:8000/api/v1/` via Vite's `/api` proxy. Verify:
* `GET http://localhost:5173/api/v1/projects/` → proxied to `8000`
* `Authorization: Bearer <access>` + `X-Organization-Id` headers present (Network tab)

### 2. Production (same-origin)

Build frontend with `VITE_USE_MOCK=false` and serve `frontend/dist` via Django's `WhiteNoise` or Nginx same-origin:

```
VITE_USE_MOCK=false VITE_API_URL="" npm run build
# Django serves /api/ and /media/ and static at /
```

Or with absolute origin:

```
VITE_USE_MOCK=false VITE_API_URL=https://api.studiohub.example npm run build
```

### 3. Exact `ApiClient.ts` diff (for rollback reference)

```diff
- import { dispatchMockRequest } from '@/mocks/mockRouter';
+ import { dispatchMockRequest } from '@/mocks/mockRouter';
+ const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
+ const API_PREFIX = import.meta.env.VITE_API_URL || '';
+ function shouldUseMock(): boolean { return USE_MOCK; }

- constructor(prefix = '') {
+ constructor(prefix = API_PREFIX) {

- const mockRes = await dispatchMockRequest<...>(...);
- if (mockRes) return mockRes.data;
+ if (shouldUseMock()) {
+   const mockRes = await dispatchMockRequest<...>(...);
+   if (mockRes) return mockRes.data;
+ }

- const response = await ky.post('/api/v1/auth/refresh/', ...)
+ const response = await ky.post(`${API_PREFIX}/api/v1/auth/refresh/`, ...)
```

**Rollback:** set `VITE_USE_MOCK=true` (default) and restart Vite — no code revert needed. After one release cycle, remove the `dispatchMockRequest` import and the `if (shouldUseMock())` branches entirely, and delete `src/mocks/` (keep for reference).

## Verification Checklist (Phase L — E2E)

* [ ] `VITE_USE_MOCK=false` → login at `/login` with `supervisor@studiohub.vfx` / `password123` succeeds, `GET /api/v1/auth/me/` returns `FrontendUser` with `role`/`permissions`/`organization_id`
* [ ] `GET /api/v1/projects/` (paginated, `search`, `ordering`, `filters`) → `200 {count,next,previous,results}`
* [ ] `GET /api/v1/organizations/` (legacy flat) — bare array without `?page`, paginated with `?page=1`; detail by `id` and uppercase `code`
* [ ] `GET /api/v1/departments/` `/teams/` `/offices/` — bare arrays
* [ ] `GET /api/v1/people/` — paginated `PaginatedResponse<Person>`
* [ ] `POST /api/v1/tasks/bulk-status/` etc — bulk ops return `{success,updated_count}`
* [ ] `POST /api/v1/timelogs/{id}/approve/` → `Approved`
* [ ] `POST /api/v1/versions/{id}/publish/` → `is_published=true`
* [ ] `POST /api/v1/reviews/{id}/approve/` → status `Approved`
* [ ] `GET /api/v1/media/` (bare array) and `GET /api/v1/playlists/` (bare array) with `add-entry` etc
* [ ] `GET /api/v1/workflows/{id}/simulate/` → `WorkflowDryRunResult`
* [ ] `GET /api/v1/scheduling/events/` and `GET /api/v1/analytics/kpis/` (stub bare arrays/objects)
* [ ] `X-Organization-Id` header — switching org via `POST /api/v1/organization/organizations/{id}/switch/` → subsequent `GET /api/v1/projects/` scoped to that org
* [ ] Error shapes — `400 {field: [msg]}`, `401 {detail}`, `403`, `404`, `429 {detail}` all JSON (never HTML), via `custom_exception_handler` + `RateLimitMiddleware`
* [ ] `GET /api/schema/` + `GET /api/schema/swagger-ui/` — 0 errors, golden file matches `docs/api/api-contract.md` inventory (see `apps/core/tests/test_contract.py`)
* [ ] `python manage.py seed_dev --force` — idempotent, covers Org → Projects/Shots/Assets/Tasks/Timelogs/Versions/Reviews/Playlists/Media/Workflows

## Decision

*Keep `src/mocks/` for one release cycle after switch for rollback. Do not delete MSW immediately (per `backend-implementation-plan.md` Phase K).*
