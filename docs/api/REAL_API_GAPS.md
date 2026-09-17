# Real API Gaps + Implementation Plan (Phase 2 refresh, 2026-09-12 — analysis only, no code changed)

Evidence: refreshed matrix (`docs/api/API_MIGRATION_MATRIX.md`) vs `backend/apps/`
verified 2026-09-12; frontend unchanged since 2026-09-10. Prior revision of this file
(2026-09-11) is superseded: P0-1/P0-2/P1-1/P1-2/P1-3 are now RESOLVED.

> **Phase 5 update (2026-09-12):** frontend↔real-API verified live with MSW disabled
> (`studiohub-react`, Playwright). Projects/shots/tasks pages hit Django directly (200);
> shot soft-delete archive/restore lifecycle confirmed (POST 201 → PATCH 200 → DELETE 204 →
> archived list → restore 200). Backend suite 1842 passed / 1 skipped. See
> `API_MIGRATION_MATRIX.md` §10. Remaining gaps below are P2+ (Show epic, analytics, AI, reports).

## Gap register

| ID | Gap | Status | Impact |
|---|---|---|---|
| P0-1 | Compat refresh dropped rotated refresh → session died after 2nd refresh | **RESOLVED** | `AuthRefreshView` now returns `{access,refresh}` (`backend/apps/identity/api/views/auth_compat.py:91-118`); regression test refresh-twice → 200/200 |
| P0-2 | `Person` had no org FK; `PersonViewSet` bypassed scoping → unscoped cross-org reads | **RESOLVED** | Nullable `organization` FK (`backend/apps/organization/models/person.py:23`) + fail-closed scoping (`api/viewsets/person.py:16,54-55`); legacy NULL rows = documented global-directory exception |
| P1-1 | Master-data API entirely absent (~48 frontend paths) | **RESOLVED** | Platform catalog + org bundle/config/custom implemented (`apps/masterdata/api/urls.py:38-218`); 11 API tests green |
| P1-2 | Delivery/publishing vocabulary + field skew | **RESOLVED (backend)** | Output maps + destination aliases + retry serializers in place (`apps/deliveries/api/serializers/delivery.py:13-16`, `destination.py:13-18`; `apps/publishing/api/serializers/publish.py:13-28,213-217`), tested. Remaining rewire of local-only frontend services is frontend-phase work |
| P1-3 | `GET …/activity/` + `/api/v1/activity/` had no route (live caller `useOrganizationActivity`) | **RESOLVED** | `ActivityCompatViewSet` flat alias (`backend/apps/audit/api/urls.py:30-34`) + nested org activity |
| P1-4 | Search/saved/recent, AI chat/risks/summaries, automations rules/logs, scheduling capacity/overbooking, analytics values, reports/notifications return empty/echo/hardcoded stubs behind live UI hooks | **PARTLY RESOLVED — see triage** | Saved/recent, automations, scheduling aggregates + reports/notifications implemented; global search, AI, analytics remain DOCUMENTED-STUB |
| P2-1 | Show entity/routes absent (MSW orphans, no model) | **RESOLVED** | `production.Show` model + org-scoped CRUD (`/api/v1/shows/`, id-or-code), seeded primary show per project, frontend `show_id` values are real UUIDs |
| P2-2 | Analytics dashboards hardcoded (prod kpis/departments literals; intel 1-KPI stub) | **RESOLVED (prod)** | KPIs/departments compute from real models org-scoped; unmeasurable farm telemetry returns null (UI renders unknown). Intel 1-KPI stub remains DOCUMENTED-STUB |
| P2-3 | Attachment entity-link via metadata vs frontend `entity_type/entity_id` | OPEN (narrowed) | Compat list shape confirmed bare-array (MATCH); only the entity-link mapping layer remains |
| P2-4 | Project command-center dashboard had no backend (`GET …/projects/{id}/dashboard/`) | **RESOLVED (Phase 6, 2026-09-17)** | `ProjectDashboardSelector.build` aggregates real Shot/Task/Asset/Review/DeliveryPackage/ChangeLog rows into the exact `ProjectDashboardData` shape (primary `@action` + nested `/api/organizations/…/projects/…/dashboard` fallback); zod-validated; 13 tests |
| P2-5 | Audit FilterSets silently dropped on namespaced resources (`.queryset` vs `.qs`) | **RESOLVED (Phase 6)** | 8 viewsets return `.qs`; regression tests with negative controls; also added `?organization_id=` alias, flat detail route, `/api/v1/activity/` fallback alias |
| P2-6 | `analytics/kpis/` field skew vs `ProductionKpis` (`quota_tb`, missing project/artist counts) + zeroed org scope for JWT callers | **RESOLVED (Phase 6)** | Exact contract fields (`storage_quota_tb`, `average_render_time_mins`, `total_active_projects`, `active_artists`); org context resolved in-view; also fixed swapped storage used/quota unpacking |
| P2-7 | Dashboard accuracy: fake widget literals, fabricated velocity history, truncated-count aggregation, watchlist undercount, mock-id store reset | **RESOLVED (Phase 6b)** | DB-side exact aggregation (no 5000-row caps) + `tasks.critical`/`rejected_reviews`; `dashboardMetrics.ts` utils (11 unit tests); velocity tab honest empty state; persisted real selections survive reload; `dashboard-accuracy.spec.ts` (5 E2E: UI==API, A→B→A, refresh, empty, failure) |

## P1-4 stub triage (decided 2026-09-12 — implement in build phase, not here)

| Surface | Live caller | Verdict | Rationale |
|---|---|---|---|
| Global search | `SearchService.ts` (+ in-memory fallback) | DOCUMENTED-STUB now; REAL via pg_trgm P2 | Fallback makes empty safe; no index infra — Postgres trigram avoids ES |
| Saved / recent searches | `SearchService.ts:166-255` (expects round-trip) | **RESOLVED** (`intelligence.SavedSearch/RecentSearch`, user+org-scoped, 10 tests) | — |
| AI chat / risks / summaries | `AIService.ts` (+ mock fallback), `useAIWorkspace` | **RESOLVED — real heuristics** (`apps/intelligence/api/viewsets/ai.py`, 17 tests) | All responses recomputed per request from real production data via local heuristics; no LLM API, no hardcoded literals. Risks (schedule/quality/resource/delivery), project & shot summaries, workload-rebalancing task recommendations, rule-based chat, permission context; org-scoped. Resolve/apply advisory no-ops. Fields without a data source return `null`. LLM+index epic remains roadmap |
| Automations rules / audit-logs | `WorkflowService.ts:57-74` | **RESOLVED** (`production.AutomationRule/AutomationAuditLog`, nested-trigger serializer, `services.automation`, 12 tests) | Legacy `Workflow.automation_rules` JSONField retained untouched |
| Scheduling capacity / overbooking / resolve | `SchedulingRepository.ts:41-49` | **RESOLVED** (weekly selectors `scheduling/selectors/capacity.py` + triage service `services/capacity.py`, 15 tests) | Resolve flags excess bookings `Overbooked`; alerts recompute from data (still over capacity until replanned) |
| Analytics (prod kpis/departments, intel `<domain>`) | dashboards | REAL-lite P2 (compute counts) or DOCUMENTED-STUB | Hardcoded 100/50 values mislead — never ship silent fakes as real |
| Reports / notifications | `organizationApi.ts:595,600` | **RESOLVED** (platform app) | `apps.platform.ProductionReport`/`StudioNotification` models, org-scoped selectors + `ProductionReportViewSet`/`StudioNotificationViewSet` (bare-array), seeded; legacy org stubs removed |

## Prioritized plan (do not implement in this phase)

### P0 — Security / contract blockers
- None open. Lock in with the existing regression tests (refresh-twice, person isolation,
  master-data contract); do not regress silently.

### P1 — Required models/APIs
1. ~~Saved/recent search persistence~~ — **DONE** (Phase 3).
2. ~~Automations persistence~~ — **DONE** (Phase 3; dedicated models, JSONField untouched).
3. ~~Scheduling aggregates~~ — **DONE** (Phase 3).
4. **Stub documentation**: search/AI/reports/notifications/analytics marked DOCUMENTED-STUB
   in code docstrings + contract notes; frontend empty-states remain frontend-phase work.

### P2 — Required behavior
5. ~~Show epic~~ — **DONE**: model + scoping + mockRouter routes + frontend context wiring.
6. **Analytics domains**: computed KPIs/widgets (prod + intel) or documented stub.
7. **Attachment entity link**: explicit `entity_type/entity_id` mapping (fields or documented
   metadata convention) before media workflows rely on it.
8. **Global search REAL**: Postgres trigram index implementation (no Elasticsearch).

### P3 — Improvements
9. Reconcile mock-miss semantics (ApiClient 404 vs MSW bypass) into one documented contract.
10. Unify state-change idioms (action POSTs vs PATCH-status) for future endpoints.
11. `check-existence`/`bulk` union envelope conformance tests per resource.
12. Cross-cutting residuals from matrix §9: id-or-code detail lookups, shots duplicate-code
    409, `include_archived` params, `lead_artist` search, timelog sort default, versions
    required-field errors.
 13. Frontend-owned cleanup (separate phase, backend tracks only): duplicate `time-001` ids,
    duplicate `useProject`/`useTaskMutations` hooks, roles/permissions mock shape quirks,
    delivery/publishing service rewire to HTTP.

## Phase 6 integration findings (2026-09-13, verified live)

- **FIXED — knowledge-base org bypass (backend, high)**: `intelligence`
  `_resolve_organization` trusted the client `X-Organization-Id` header with
  no membership check, so any authenticated user could read another org's
  `KnowledgeDocument`s (proven live: B-token@A-org returned all 6 APEX docs).
  Now fail-closed for non-staff without a live membership, mirroring
  `ActivityCompatViewSet`. Same hardening applied to `search.py`. Regression
  tests: `test_list_cross_org_header_leaks_nothing`,
  `test_retrieve_cross_org_header_404`. Member + staff access unchanged.
- **FIXED — seed RBAC gap (seed data)**: zero roles held any of the 24
  organization-domain codes (`organization.view`, `organization.team.view`,
  `person.view`, …), so every non-superuser got 403 on all org endpoints.
  `seed_dev` now seeds the codes and grants directory views org-wide,
  full org CRUD to `org-admin` (+ all to `platform-admin` via catch-all).
  Matrix extracted to `_role_perm_matrix` with `_assign_role_permissions`
  for idempotent backfill. Verified live: artist reads (200) but cannot
  create/delete (403); org-admin manages (200/201, 400 on bad FK).
- **FIXED — 404s logged as 500 + retried (frontend)**: `mapHttpError` dropped
  the status of adapter-thrown `AppError`s, so `QueryProvider` logged
  `(500 - SERVER)` and retried 404s. Status-carrying errors now map via
  `ApiError.fromDrfResponse`. Verified live: cross-org detail logs
  `(404 - NOT_FOUND)` exactly once.
- **FIXED — non-superuser app lockout (frontend)**: login/`/me` payloads
  carry no `memberships`, so `OrganizationRoute` denied the whole shell.
  `RESTAuthAdapter` now hydrates memberships from
  `/api/v1/users/me/memberships/` on login + session bootstrap (best
  effort), and `OrganizationContext` falls back to membership-synthesized
  orgs when the org directory denies. Verified live as `owner@apex.vfx`:
  teams/departments/clients/offices all render real data.
- **Observed (no change)**: all 10 seed `Person` rows have
  `organization=NULL`, so org-scoped members correctly see 0 people while
  staff see 10 — seed-data quality note, not an integration failure.
- **Observed (no change)**: shots-card row checkbox shows no bulk-action
  affordance in UI; backend bulk endpoints exist and are isolation-tested.
  Frontend UX gap for a later pass.

## Resolved frontend contract fixes (Phase 5 verification)

- **Create team fixed (2026-09-12)**: `CreateTeamPage.tsx` previously POSTed a display-oriented
  payload (`department_id`, `lead_id`, `focus_discipline`, `capacity_hours_weekly`, ...) that the
  backend `TeamCreateSerializer` rejected (`400`: `organization` + `department` required). Submit
  now maps to the backend contract (`name`, `code`, `description`, `department`, `organization`,
  `color`, `capacity`) and resolves the default department after async load. Verified create (200)
  and update PATCH (200) against the real API.
- **Remaining limitation — team `lead`**: the create form's Squad Lead selector returns **Person**
  UUIDs (from `/people/`), but `Team.lead` is an FK to `AUTH_USER_MODEL`. No Person→User mapping
  exists, so `lead` is currently omitted (null) on create. Assigning a real lead requires either a
  Person→User link or exposing a user-picker; tracked as follow-up, not part of this fix.
