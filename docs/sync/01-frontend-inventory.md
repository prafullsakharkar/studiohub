# 01 — Frontend inventory (Phase 0, read-only)

`frontend/` as synced from `studiohub-react` (commit `bfbdfc1`), inspected on branch `sync/phase-0-discovery`. No frontend file was changed. Evidence is cited as `frontend/src/<path>:<line>`; scanner output is reproducible with [`tools/fe_calls.py`](tools/fe_calls.py), [`tools/fe_literals.py`](tools/fe_literals.py), [`tools/coverage.py`](tools/coverage.py).

## 1. Stack and baseline

| Item | Value |
|---|---|
| Language | TypeScript 5.8 (strict), 703 files under `src/` |
| UI | React 19, MUI 9 + Emotion, Tailwind 4, Lucide icons, Recharts |
| Routing | React Router 7 (`src/routes/AppRoutes.tsx`, 329 lines) |
| Data | TanStack Query 5 (`src/providers/QueryProvider.tsx`: staleTime 2 min, retry with backoff for non-4xx, no mutation retry, no refetch on focus) + Zustand 5 stores |
| HTTP | `ky` 2 wrapped by `ApiClient` (`src/api/client/ApiClient.ts`) |
| Forms | react-hook-form 7 + zod 4 (`@hookform/resolvers`) |
| Types from backend | `openapi-typescript` 7 → `src/core/api/generated/openapi.ts` (1.5 MB) from a committed schema snapshot `src/core/api/generated/schema/django-openapi.yml` (2026-10-19) |
| Tests | Vitest 5 + Testing Library + jsdom; Playwright for e2e (`e2e/`) |
| Lint | `tsc --noEmit` (`pnpm lint`/`typecheck`), Biome 2 (`pnpm lint:biome`) |
| Dev server | Express `server.ts`: Vite middleware in dev, static `dist/` in prod; proxies `/api/`, `/media/`, `/staticfiles/`, `/admin/` to `VITE_API_URL` (default `http://127.0.0.1:8000`) |
| Env | `VITE_API_URL` (base URL; empty = same origin through the proxy), `DJANGO_HEALTH_PATH` (default `/api/health` — wrong, the backend health route is `/health/`) |
| Mock layer | **Removed.** No `src/mocks/`, no MSW. Every call goes to Django. Leftover shims remain (see §8). |

Baseline run on this branch (2026-10-29), before any change:

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm test` | ✅ 47 files, 168 tests passed |
| `pnpm build` | ✅ (vite + esbuild server bundle) |
| `pnpm lint:biome` | ❌ 2 errors, 4,142 warnings (pre-existing; mostly `useImportType`) |

## 2. Folder structure (what is actually there)

```
src/
  api/client/          ApiClient (ky), types
  api/errors/          ApiError (DRF parser), AppError, errorMapper
  api/repositories/    BaseRESTAdapter + REST adapters: Auth, Project, Shot, Task, Asset, Delivery, Publishing; factory/config
  api/masterDataApi.ts directory + catalog + RBAC calls (one big module)
  core/repository/     BaseRepository (second CRUD base class)
  core/api/            centralErrorHandler, generated OpenAPI types + ContractValidator
  core/auth/           AuthProvider, tokenStorage, demoUserUtils
  core/permissions/    ~9.5k lines: rbac, permissionCatalog, systemRoles, routePermissionsRegistry, field/scope/workflow/external/bulk engines
  core/access/         domainPermissions
  core/testing/        in-app "TestRunnerEngine" + suites (mock-era harness)
  modules/<28 modules> pages/components/hooks/services/repositories|api
  features/dashboard   dashboard data (projects/{id}/dashboard)
  shared/              crud components, hooks (useBulkDelete, trackEntityMutation), stores (activity, notifications, permissions, timer…)
```

Three parallel data-access styles coexist, all funnelling into `apiClient`:
1. `BaseRESTAdapter` subclasses in `src/api/repositories/adapters/rest/` (auth, projects, shots, tasks, assets, deliveries, publishing) — `request()` delegates to `apiClient` (`BaseRESTAdapter.ts:35-66`).
2. `BaseRepository` subclasses in modules (`src/core/repository/BaseRepository.ts`): episodes, sequences, playlists, reviews, timelogs, workflows, editorial tracks, audit ledgers.
3. Plain API objects: `src/api/masterDataApi.ts`, `modules/access/api/accessApi.ts`, `modules/people/api/personApi.ts`, `modules/production/api/projectScopedApi.ts`, scheduling/versions services.

## 3. Routes and pages

From `AppRoutes.tsx` (plus `platformRoutes`, `auditRoutes` spread in at lines 284/303):

| Area | Routes | Module |
|---|---|---|
| Auth (guest) | `/login`, `/forgot-password`, `/auth/change-password` | auth |
| Home | `/`, `/dashboard`, `/workspace` | features/dashboard, workspace |
| Directory | `/people[/new|/:id|/:id/edit]`, `/departments…`, `/teams…`, `/offices…`, `/clients[/new|/:id]`, `/vendors[/new|/:id]` | people, departments, teams, offices, clients, vendors |
| Production | `/projects[/new|/:id|/:id/:tab|/:id/edit|/:id/assets]`, `/shows/:showId`, `/shots[/:shotId[/:tab]]`, `/projects/:projectId/shots/:shotId[/:tab]`, `/assets…`, `/projects/:projectId/assets/:assetId[/:tab]`, `/tasks[/:taskId]`, `/timelogs`, `/versions[/:versionId]`, `/reviews`, `/workflows` | production, shots, assets, tasks, versions, reviews, workflows |
| Pipeline | `/publishing`, `/deliveries[/:id]`, `/scheduling`, `/calendar` | publishing, deliveries, scheduling |
| Admin | `/settings` (→ redirect `/platform/admin/pipeline`), `/settings/permissions`, `/permissions`, `/access[/:section]`, platform routes (admin, master data, health, reports, notifications, data platform), audit routes (activities, audit logs, change logs, API requests, background jobs, error logs, login history, tracks, workspaces) | settings, access, platform, audit |
| Dev | `/testing` | core/testing |
| Errors | `/unauthorized`, `/forbidden`, `/error`, `*` | pages |

Guards: `ProtectedRoute`/`AuthenticatedRoute` (user present), `GuestRoute`, `PermissionRoute`/`RoutePermissionGuard` (permission codes from `core/permissions/routePermissionsRegistry.ts`), `ProjectRoute` (project membership from `user.project_memberships`).

## 4. Every backend call, by module

327 call sites with a literal URL were resolved ([`tools/fe_calls.py`](tools/fe_calls.py)); 496 distinct URL literals were matched method-agnostically against the 506 backend routes ([`tools/fe_literals.py`](tools/fe_literals.py)). Of the non-test literals, 208 match a real route, 28 match nothing. Test-harness literals (`core/testing`, `__tests__`) are excluded below.

| Module (data file) | Backend paths used (`/api/v1` prefix dropped) | Paths with **no backend route** |
|---|---|---|
| `api/masterDataApi.ts` | `/client-contacts`, `/client-contracts`, `/clients`, `/departments`, `/groups`, `/offices`, `/people`, `/positions`, `/roles`, `/teams`, `/vendors`, `/vendor-contacts`, `/vendor-contracts`, `/platform/master-data/{asset-types,file-types,review-types,shot-types,software(+versions),statuses,task-types}` incl. `archive`/`restore`, `/platform/overview`, `/versions` | — |
| `api/client/ApiClient.ts` | `/auth/refresh` | — |
| `api/repositories` adapters | `/auth/{login,refresh,logout,me,change-password}`, `/projects`, `/shots`, `/tasks`, `/assets`, `/deliveries` (+ actions approve/cancel/complete/prepare/reject/retry/submit, `destinations/`), `/publishing` (+ republish/retry/unpublish/validate, `destinations/`), `bulk-*` and `check-existence/` for shots/assets/tasks | — |
| `core/repository/BaseRepository.ts` | generic CRUD on `basePath` + `restore/` | default **`bulk/` (POST/PATCH)** and `bulk-delete/` — backend uses `bulk-create/`, `bulk-update/`; `bulk-delete/` exists only for tasks and scheduling schedules. Episodes/sequences override these with the correct paths; any subclass that relies on the default breaks |
| `features/dashboard` | `/projects/{id}/dashboard` | — |
| `modules/access/api/accessApi.ts` | `/roles`, `/groups`, `/permissions`, `/positions`, `/activity` | — (but typed as bare arrays; these are paginated) |
| `modules/attachments` | `/attachments` (compat, bare array) | — |
| `modules/audit/repositories/auditRepositories.ts` | `/audit` (frontend-shaped audit log), `/audit/{api-requests,background-jobs,change-logs,error-logs,tracks}` | **`/audit/login-history`** (real: `/identity/login-history/`) |
| `modules/episodes`, `sequences`, `playlists`, `reviews`, `media`, `vendors`, `clients` | their collection + detail routes | — |
| `modules/people/api/personApi.ts` | `/people`, `/people/{id}` | **`/people/{id}/set-password/`** (no such action; passwords belong to identity users) |
| `modules/platform` | `/info/version` | **`/api/health`** (proxy route; Django health is `/health/`), **16 stale health-probe paths** in `health/apiHealthData.ts` (`/api/projects/`, `/api/render-farm/status`, …), **`/reports/`** (`pages/ReportsPage.tsx:23`; reports app removed) |
| `modules/production/api/projectScopedApi.ts` | `/api/organizations/projects/{id}/{summary,sequences,shots,tasks,assets,versions,reviews,editorial,notes,deliveries,schedule,resources,pipeline,files,activity,members}` | — (`POST notes/` needs `note.create`, `POST members/` needs `project.update`; both verified in `project_scoped.py:271-289,472-484`) |
| `modules/scheduling` | `/scheduling/{capacity,events,holidays,leaves,overbooking,resolve-overbooking,resources}` | — |
| `modules/tasks` | `/tasks/{bulk-assign,bulk-delete,bulk-status}`, `/timelogs`, `/timelogs/{id}/{approve,reject}` | — |
| `modules/versions` | `/versions` + `add-to-playlist`, `archive`, `publish`, `unpublish` | — |
| `modules/workflows` | `/workflows` (+ actions), `/automations/{rules,audit-logs}` | — |
| `shared/hooks/useBulkDelete.ts` | — | **`/{resource}/bulk-delete/`** for every resource (exists only for tasks and schedules) |
| `modules/audit/pages/ApiRequestsPage.tsx:56` | — | display-only literal `/api/v1/production/shots` (example data) |

Backend coverage by the frontend (method-agnostic, heuristic, [`tools/coverage.py`](tools/coverage.py)): **264 of 486 API paths touched, 222 untouched**. Untouched areas in full: all of `identity/*` (users, profiles, sessions, MFA, PATs, API keys, security events, login history/attempts, IP blacklist), all of `settings/*`, `core/tags`, `core/attachments`, `task-templates`, `scheduling/{calendars,milestones,schedules}`, `publishing/{files,storage-roots}`, `analytics/*`, `audit/{audit-logs,activities}`, and every `archived/`, `archive/`/`restore/` (except versions and catalog), `rename-code/`, `status-history/` action. Bulk (`bulk-create/update/archive/restore`) and `check-existence/` **are** wired for shots, assets, tasks, episodes and sequences through their adapters/repositories. Details per resource are in [02-gap-analysis.md](02-gap-analysis.md).

## 5. Auth handling

| Concern | Implementation | Observation |
|---|---|---|
| Login | `RESTAuthAdapter.login` (`api/repositories/adapters/rest/RESTAuthAdapter.ts:12-26`) → `POST /api/v1/auth/login/` `{email,password}`; stores `response.tokens` | **Ignores `mfa_required`/`challenge`** (no tokens → `AuthProvider` sets `user` to `undefined`); ignores `mfa_enrollment_required`. No MFA challenge screen. |
| Token storage | `core/auth/tokenStorage.ts`: access + refresh in **`localStorage`** and module memory | XSS-exposed; `getRefreshToken()` never re-reads storage, so another tab's rotation is invisible. |
| Refresh | `ApiClient.handleTokenRefresh` (`ApiClient.ts:81-125`): on 401, single-flight per tab, retry once, store rotated refresh | **No cross-tab lock.** Backend revokes the whole session on refresh-token reuse (verified), so two tabs refreshing together log the user out. When a refresh fails, queued requests waiting on it are discarded without being rejected (`ApiClient.ts:118-120`), so they hang forever. |
| Logout | `RESTAuthAdapter.logout` → `POST /auth/logout/` **without the refresh token**, then clears storage | Backend accepts `{refresh?}`; the session is revoked via the access token's session, so it works, but the refresh token is not explicitly blacklisted. |
| Current user | `GET /auth/me/` on boot (`AuthProvider.tsx:26-43`) | OK. `must_change_password` handled by `modules/auth/utils/passwordChangeGuard.ts`. |
| Profile update | `PATCH /auth/me/` with `Partial<User>` | Sends User-shaped data; backend accepts only Profile fields (unknown keys dropped silently). |
| Change password | `POST /auth/change-password/` `{old_password,new_password,confirm_password}` | Backend revokes all sessions on success (API-AUTH-06); UI must re-login. |
| Forgot/reset | `ForgotPasswordPage` | reset-password route not wired (backend `POST /auth/reset-password/` untouched). |
| Demo users | `useDemoUsers`, `demoUserUtils.ts`, `RESTAuthAdapter.getDemoUsers` → `[]` | Mock-era; dead. |
| Client-side "activity" | `AuthProvider` calls `useActivityStore.recordActivity` on login/logout (in-memory only) | Fake audit trail; the backend already records login history. |

## 6. Permissions and role-based UI

- Source of truth on the client: `user.permissions` from `/auth/me/` **merged with** a client-side role→permission matrix (`core/permissions/rbac.ts:240-290` uses `ROLE_PERMISSIONS[user.role]`, `systemRoles.ts`) keyed by the role *display name*. That second source diverges from the backend resolver.
- `platform.*` / `global.*` codes short-circuit to `true` for `is_superuser`; other codes do not, although the backend lets superusers do everything (and sends a 23-code fallback list that does not match the catalog).
- **Code drift:** the frontend references **358 distinct permission strings; 290 do not exist in the backend** (catalog ∪ enforced). Examples: `people.view`, `department.create`, `client.update` (backend: reads are open, writes need `masterdata.directory.manage`); `platform.status.update` etc. (backend: `masterdata.catalog.manage`); `api_requests.view`, `change_logs.view`, `error_logs.view` (backend: `audit.view`); `roles.manage`, `permissions.manage`, `security.manage` (backend: `identity.role.*`, `identity.permission.*`); `page.project.*` (no backend equivalent); `organization.*` (organizations removed); `field.*` (backend uses `masterdata.client.view_financial`, `schedule.view_rates`, …). Full list: produced by the Phase 0 scan, summarized in the gap analysis.
- Guards: route guards consult `routePermissionsRegistry.ts`; components use `<Can>`, `<HasRole>`, `PermissionControl`, `usePermissions`, `usePermissionEvaluator`. ~9.5k lines across `core/permissions` + `core/access`, including field-, scope-, workflow-state-, external-access- and bulk-authorization engines that model rules the backend does not expose.

## 7. Error handling, loading and forms

- `ApiError.fromDrfResponse` (`api/errors/ApiError.ts:240-354`): reads `detail`, `non_field_errors`, field maps and `error_code`. It does **not** read the backend's `error.code`/`error.request_id` object, SimpleJWT's `code`/`messages`, or nested serializer errors (objects / arrays of objects). `Retry-After` is not surfaced.
- `mapHttpError` → `centralErrorHandler` (`core/api/error-handler.ts`) emits auth-expired / account-disabled events consumed by `AuthProvider`.
- `ContractValidator` (`core/api/generated/validator.ts`) validates requests/responses against the stale generated contract at runtime.
- Loading/empty/error: canonical components exist (`components/system`: `LoadingState`, `ErrorState`, `ConfirmDialog`, gates); usage is uneven (many pages hand-roll states).
- Notifications: `useNotificationStore` (client-only toasts).
- Forms: zod schemas exist only in `modules/auth/schemas`; other modules use hand-built forms or `shared/crud/EntityForm` + `fieldSchemas.ts` with client-side field configs not derived from backend serializers. Server field errors are not systematically mapped onto inputs.
- Pagination: list hooks generally pass `page`/`page_size`, but **~50 call sites normalise with `Array.isArray(res) ? res : res.results`** (e.g. `api/masterDataApi.ts:154-275`, `RESTPublishingAdapter.ts:39`), discarding `count`/`next` — lists silently stop at the first 25 rows.
- Envelope mismatches in both directions: `accessApi` types paginated `/roles|groups|permissions/` as arrays; `BaseRepository.findAll` types bare-array endpoints (`/media/`, scheduling, settings, identity) as `PaginatedResponse`.

## 8. Hard-coded, mock-era and dead code

| Item | Location | Status |
|---|---|---|
| Project workspace tabs with **no backend data** (empty fallbacks + local `useState`): Activity, Attachments, Calendar, Deliveries, Media, Overview, Pipeline, Playlists, Publishing, Resources, Reviews, Schedule, Timelogs, Workflow (14 of 22 tabs; marked `// REST-only shim`) | `modules/production/components/project-tabs/*.tsx` | backend has data for all of them (project-scoped views + `?project=` filters) |
| In-app test runner + suites calling `/api/projects/proj-001/...` and `?mock_error=` | `core/testing/**`, route `/testing` | mock-only, dead |
| Health probe list of 16 non-existent `/api/*` paths | `modules/platform/health/apiHealthData.ts`, `useApiHealth.ts` | stale |
| Reports, Notifications, Data Platform pages | `modules/platform/pages/{ReportsPage,NotificationsPage,DataPlatformPage}.tsx` | backend apps removed |
| "Push mock roles… to the backend" seeding button | `modules/platform/pages/PlatformAdminPage.tsx:392` | mock-era |
| "Mock DB Schema & Export" section | `modules/settings/pages/SettingsPage.tsx:238`, `components/DatabaseSchemaSection.tsx` | mock-era |
| Demo users | `core/auth/demoUserUtils.ts`, `modules/auth/hooks/useDemoUsers.ts` | dead |
| Client-side activity buffer | `core/activity/activityService.ts`, `shared/stores/useActivityStore.ts` | duplicates `/activity/` |
| `features/organizations/` | empty directory | dead |
| Stale generated contract | `core/api/generated/*` (schema 2026-10-19: 56 operations removed since, 126 added) | regenerate |
| Frontend `CLAUDE.md` | still documents MSW, mocks and an `intelligence` module | stale doc |
