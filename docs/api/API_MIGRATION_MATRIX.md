# Frontend → Backend API Migration Matrix (Phase 2, refreshed 2026-09-12)

Source: Phase 1 inventory (`docs/api/MOCK_API_INVENTORY.md`, re-verified 2026-09-10;
frontend unchanged since) vs `backend/apps/` (re-verified 2026-09-12 — prior revision
of this file dated 2026-09-11; statuses flipped by P0-1/P0-2/P1-1/P1-2/P1-3 are
marked **[FLIP]** with code evidence).

Status: **MATCH** (contract-compatible as-is) · **PARTIAL** (path exists, shape/semantics differ) ·
**MISSING** (no backend route) · **INCOMPATIBLE** (conflicts; one side must change) ·
**OBSOLETE** (no caller on either side / intentionally absent) · **EXTRA** (backend-only, keep).

## 1. Auth

| Frontend Endpoint | Backend Endpoint | Status | Required Change |
|---|---|---|---|
| POST /api/v1/auth/login/ | `AuthLoginView` → `{tokens:{access,refresh},user}` | MATCH | None |
| POST /api/v1/auth/refresh/ | `AuthRefreshView` → `{access,refresh}` (rotated) | MATCH **[FLIP]** | None — was INCOMPATIBLE (dropped rotated refresh); now returns the rotated pair (`backend/apps/identity/api/views/auth_compat.py:91-118`), regression-tested (refresh twice → 200/200) |
| POST /api/v1/auth/logout/ | `AuthLogoutView` | MATCH | None |
| GET /api/v1/auth/me/ | `AuthMeView` → `FrontendUser` | MATCH | None |
| GET /api/v1/auth/memberships/ · GET /api/v1/users/me/memberships/ | `AuthMembershipsView` + alias | MATCH | None (mock-only, no caller — keep for future) |

## 2. Organizations (flat `/api/v1/`, nested `/api/organizations/{org}/`, namespaced)

| Frontend Endpoint | Backend Endpoint | Status | Required Change |
|---|---|---|---|
| Organizations CRUD + PATCH status | `LegacyOrganizationViewSet` | MATCH | Title-Case statuses already accepted |
| departments/teams/offices (+CUD, bare `[]`) | `Legacy*` bare-array aliases | MATCH | None |
| people/clients/vendors (+CUD, paginated) | `legacy-person/client/vendor` | MATCH **[FLIP]** | None — was PARTIAL (no org FK, unscoped reads); `Person.organization` nullable FK now exists (`backend/apps/organization/models/person.py:23`) and `PersonViewSet` scopes reads fail-closed (`backend/apps/organization/api/viewsets/person.py:16,54-55`). Legacy NULL-org rows stay visible as documented global-directory exception |
| positions/invitations/work-calendars/work-hours/calendars/holidays/roles/groups/permissions/api-keys/pats (+resend/revoke) | `Compat*` bare-array + status-word compat | MATCH | None |
| clients/{id}/contacts\|contracts, vendors/… (mock data exists) | `ClientContact/VendorContact/ClientContract/VendorContractViewSet` | EXTRA | No frontend caller; keep |
| GET /api/v1/organization/ (singleton) | `LegacyOrganizationSingletonView` | MATCH | None |
| GET+PATCH billing/ | `BillingView` (PATCH staff-only, `get_or_create`-backed) | MATCH | Verify shape against `useStudioBilling` |
| GET reports/ | `ProductionReportViewSet` → REAL (bare array, org-scoped) | MATCH **[FLIP]** | Live caller `organizationApi.ts:595` expects `ProductionReport[]`; now backed by `apps.platform.models.ProductionReport` + seed. Legacy `ReportsView` stub removed |
| GET notifications/ | `StudioNotificationViewSet` → REAL (bare array, org-scoped; `mark-read`/`mark-all-read` actions) | MATCH **[FLIP]** | Live caller `organizationApi.ts:600` expects `StudioNotification[]`; now backed by `apps.platform.models.StudioNotification` + seed. Legacy `NotificationsView` stub removed |
| GET /api/organizations/{org}/…/activity/ · GET /api/v1/activity/ | flat `activity/` alias + nested org activity | MATCH **[FLIP]** | None — was MISSING; `ActivityCompatViewSet` routed (`backend/apps/audit/api/urls.py:30-34`, nested `urls_nested.py`) for live caller `useOrganizationActivity` |
| branding, organization-settings, memberships, user-roles, group-members, group-roles, role-permissions, team members, org export/switch/settings | canonical routers + actions | EXTRA | Keep; frontend has no callers |

## 3. Production flat resources

| Frontend Endpoint | Backend Endpoint | Status | Required Change |
|---|---|---|---|
| projects CRUD + GET statistics/ | `ProjectViewSet` (+statistics) | MATCH | None |
| sequences/shots/assets/tasks CRUD + archive/restore + check-existence + bulk-create/update/archive/restore | `BulkActionsMixin` union envelope | MATCH | None (both envelopes carried; see §9 residuals for id-or-code/409 notes) |
| POST shots/{id}/approve/ | `approve` | MATCH | None |
| tasks bulk-assign/status/delete | `TaskViewSet` extras | MATCH | None |
| timelogs CRUD + approve/reject | `TimelogViewSet` | MATCH | MSW skips auth; backend requires it — contract still holds since client always sends Bearer |
| reviews CRUD + 13 actions incl participant-verdict | `ReviewViewSet` | MATCH | None (`client_only` correctly absent) |
| versions CRUD + publish/unpublish/archive/promote/add-to-playlist | `VersionViewSet` | MATCH | None |
| media CRUD (bare `[]`) | `MediaViewSet` pagination=None | MATCH | None |
| attachments CRUD (bare `[]`) | `/api/v1/attachments/` compat bare + canonical paginated | MATCH | None — compat explicitly disables pagination (`backend/apps/core/api/viewsets/attachment.py:60`); canonical `/api/v1/core/attachments/` paginated is EXTRA. Corrects the stale MISMATCH note in MOCK_API_INVENTORY §8 |
| playlists CRUD + 6 actions | `PlaylistViewSet` paginated (`StandardPagination`) | MATCH | Frontend normalizes array→paginated; keep paginated |
| workflows CRUD + clone/activate/deactivate/archive/simulate | `WorkflowViewSet` | MATCH | Verify `simulate` shape vs hook |
| observability reads (`audit/api-requests|background-jobs|change-logs|error-logs|login-history|tracks`) | paginated org-scoped lists + job retry/cancel, error resolve, track ingest | MATCH | Was bare-list/405; telemetry writers (request middleware, error hook, change signals) now fill them; client simulators stay mock-only |
| editorial timeline tracks (`/api/v1/editorial/tracks/`, full CRUD) | `production.EditorialTrack` + `EditorialTrackViewSet` | MATCH **[FLIP]** | Was MISSING (404 in rest); model, org-scoped API, seed codes, isolation-tested |
| automations rules CRUD + audit-logs | `AutomationRules/AuditLogsView` (persisted, `urls.py:51-53`) | MATCH | Was PARTIAL (echo stubs); now `AutomationRule`/`AutomationAuditLog` models (`backend/apps/production/models/automation.py`), nested-trigger serializer, `automation` service, org-scoped views; audit-logs append-only list. Live callers `WorkflowService.ts:57-74` satisfied |
| scheduling events/resources/holidays/leaves CRUD + book/block/update-status/approve/reject | `scheduling` app (bare arrays, real, `OrganizationScopedViewSet`) | MATCH | None |
| scheduling capacity/overbooking/resolve-overbooking | real aggregates (`urls.py:55-57`) | MATCH | Was PARTIAL (empty stubs); now weekly capacity/overbooking selectors over real schedules (`backend/apps/scheduling/selectors/capacity.py`) + triage service flagging excess bookings `Overbooked` (`services/capacity.py`); no new models. Live callers `SchedulingRepository.ts:41-49` satisfied |
| analytics kpis/departments | computed aggregates (`api/viewsets/analytics.py`) | MATCH **[FLIP]** | Counts computed org-scoped (shots by status, tasks by department, billing quota); farm telemetry null = honest unknown |
| settings/pipeline | — | OBSOLETE | Mock-only, no caller; do not implement |
| shows (`/api/v1/shows/`, id-or-code, full CRUD) | `production.Show` + `ShowViewSet` | MATCH **[FLIP]** | Was MISSING; model, org-scoped API, seed, and frontend wiring landed |

## 4. Project-scoped nested (`/api/organizations/{org}/projects/{proj}/…`)

| Frontend Endpoint | Backend Endpoint | Status | Required Change |
|---|---|---|---|
| members GET+POST, summary, sequences, shots, tasks, assets, versions, reviews, editorial, notes GET+POST, deliveries, schedule, resources, pipeline, files, activity | `views/project_scoped.py` (16 subs) | MATCH | None |

## 5. Deliveries / publishing (frontend services are local-only; REST adapters declare real paths)

| Frontend Endpoint | Backend Endpoint | Status | Required Change |
|---|---|---|---|
| deliveries CRUD + destinations CRUD | `DeliveryViewSet` + `DestinationViewSet` (paginated, real) | MATCH **[FLIP]** | None on backend — was PARTIAL; vocab mapped in serializers (`STATUS_PREPARED→Ready`, `STATUS_COMPLETE→Completed`, `backend/apps/deliveries/api/serializers/delivery.py:13-16`; destination write-only aliases `rate/region`, `destination.py:13-18`); retry semantics tested. Outstanding work is frontend-owned: rewire `DeliveryService` from local-only to repository HTTP (frontend phase, out of backend scope) |
| publishing CRUD + destinations + validate/republish/unpublish/retry | `PublishingViewSet` (paginated, real) | MATCH **[FLIP]** | None on backend — was PARTIAL; `STATUS_OUTPUT_MAP` (`Pending→Queued`, `Validated/Exported→Published`, `Failed→Failed`, `Cancelled→Unpublished`, `backend/apps/publishing/api/serializers/publish.py:13-28`) + `PublishRetrySerializer` (`publish.py:213-217`). Same frontend-owned rewire note as above |

## 6. Intelligence / knowledge / AI

| Frontend Endpoint | Backend Endpoint | Status | Required Change |
|---|---|---|---|
| knowledge CRUD + like + link/unlink-entity | `KnowledgeDocument` views (real, persisted, per-org) | MATCH | None |
| search POST | `search.py` view (`backend/apps/intelligence/api/urls.py:30`) | PARTIAL | DOCUMENTED-STUB (no index backend; frontend in-memory fallback covers it). REAL via pg_trgm is P2 |
| saved/recent CRUD | persisted views (`urls.py:31-34`) | MATCH | Was PARTIAL (echo `save-001`/`rec-001`); now `SavedSearch`/`RecentSearch` models (`backend/apps/intelligence/models/search.py`), user+org-scoped views, real ids/timestamps. `SearchService.ts` round-trip satisfied |
| ai/chat, ai/risks(+resolve), task-recommendations(+apply), project/shot-summary, permission-context | `ai.py` views (`urls.py:39-46`) | MATCH | Rewritten (`apps/intelligence/api/viewsets/ai.py`): all responses recomputed per request from real production data (projects/shots/tasks/versions/reviews) via local heuristics — no LLM API, no hardcoded literals. Risks (schedule/quality/resource/delivery), project & shot summaries, workload-rebalancing task recommendations, rule-based chat, permission context. Resolve/apply are advisory no-ops (derived data isn't persisted). `AIService.ts` contract satisfied; org-scoped via `resolve_organization_context`. Fields without a data source (e.g. budget burn) return `null`. P1-4 LLM+index epic remains roadmap |
| analytics/`<domain>/` dashboard | hardcoded 1-KPI stub (`analytics.py:20-29`) | PARTIAL | P2-2: real per-domain KPIs/widgets or DOCUMENTED-STUB |

## 7. Master data — largest surface, now implemented

| Frontend Endpoint | Backend Endpoint | Status | Required Change |
|---|---|---|---|
| `GET /platform/overview`, `/platform/master-data/{software,statuses,task-types,asset-types,shot-types,review-types,file-types}[/{id}]` + versions + archive/restore, `/platform/{roles,groups,departments,positions}` (~30 paths, live callers in `useMasterData` + Platform tabs) | `apps/masterdata/api/urls.py:38-218`, scope=GLOBAL catalog viewsets + `PlatformOverviewViewSet` | MATCH **[FLIP]** | None — was MISSING; implemented with models, serializers, selectors, resolution service; contract covered by 11 API tests (`apps/masterdata/tests/api/test_platform_and_org.py`) |
| `/api/v1/organizations/{oid}/master-data/{bundle,per-type GET,config PUT,custom POST}` (~18 paths) | `OrganizationMasterDataViewSet` (bundle/resolvers, config upsert incl. `executable_path_overrides` mapping, custom create with `organization.master_data.*` RBAC) | MATCH **[FLIP]** | None — was MISSING; same implementation + tests as above |

## 8. Entity ↔ model verdicts (detail: `docs/database/MODEL_DATA_MAPPING.md`)

All frontend entities reuse existing models — **0 models to create**. Resolved since last pass:
`Person` scoping (nullable org FK), master-data family (14 models), `PublishItem`/delivery
vocabularies (serializer output maps), attachments compat shape (bare array confirmed).
Watch items remaining: `DeliveryPackage.code` global-unique vs per-org natural keys elsewhere,
`Attachment` entity-link via metadata vs frontend `entity_type/entity_id` (P2-3),
`Show` (epic-deferred).

## 9. Cross-cutting residuals (carried from MOCK_API_INVENTORY 2026-09-10, not re-verified this pass)

Detail-level PARTIALs rolled up into MATCH rows above; confirm before closing: id-or-code
detail lookup is UUID-only (projects/sequences/shots/assets); duplicate-code 409 on shots
POST; `include_archived`/`include_deleted` params; `lead_artist` sequence search;
timelog default date-sort; versions required-field errors. Track as P3 verification items.

## 10. Phase 5 frontend↔real-API verification (2026-09-12, Playwright, no MSW)

End-to-end verified in `studiohub-react` (`VITE_USE_MSW=false`, `VITE_API_MODE=rest`) against real
Django at `127.0.0.1:8000`. All page/network requests hit the real API (no MSW interception).

- Login + `/auth/refresh/` rotation persisted (`localStorage['studiohub_access_token']` /
  `studiohub_refresh_token`); frontend `ApiClient` auto-refreshes on expiry.
- Projects `/projects`: 8 real projects, real UUID links, client-side search works.
- Shots `/shots`: DRF pagination live — `?page=1&page_size=8&project_id=<uuid>&include_deleted=false&show_id=show-<uuid>-main` → 200, UI "Showing 1 to 7 of 7 records".
- Tasks `/tasks`: real empty state ("0 Total Tasks" — no seed tasks for DMQ01); request 200 with `project_id&is_archived=false&show_id` filters.
- Shot lifecycle (soft-delete archive/restore) verified via API: POST → 201, PATCH → 200,
  DELETE → 204 (soft archive), excluded from active list (count unchanged), visible in
  `include_deleted=true` view, POST `/{id}/restore/` → 200 (status restored).
- Notes: raw API calls require `Authorization: Bearer` + `X-Organization-ID`; frontend sends
  synthetic `show_id` (`show-<project-uuid>-main`) and mock ids (`proj-001`, `org-apex-01`)
  that resolve to real UUIDs via `ProductionContext`/`OrganizationContext`.

## 11. Phase 7 contract protection (2026-09-13)

Breaking changes must now fail loudly instead of silently breaking the
frontend. Enforcement (all passing):

- OpenAPI surface gate (`backend/apps/core/tests/test_contract.py`):
  path → HTTP-methods table for auth, production CRUD + bulk/actions,
  deliveries/publishing/scheduling, settings, audit, intelligence,
  master-data, nested org actions, and legacy aliases. Removals, renames,
  or method changes fail here.
- Regression module (`backend/apps/core/tests/test_contract_regression.py`,
  19 tests): wrong-method 405s, list/detail field/type shapes, paginated vs
  `RAW[]` envelopes, `{detail}`/field-error envelopes, cross-org denial
  without leak, seed-matrix coverage of every enforced permission code,
  search/ordering params.
- Frontend conformance (`studiohub-react/src/test/contract/
  apiContractConformance.test.ts`, 8 tests): mock envelopes, fixture
  required fields, `{detail}` 404s, error-status preservation.
  Mock policy: `studiohub-react/docs/frontend/MOCK_POLICY.md` — mocks are
  development/test fixtures, never the production data source.
- Phase 6 fixes locked in: knowledge/search membership gate (+2 isolation
  tests), seed org-domain grants (matrix-covered), 404-vs-500 error mapping,
  membership hydration + org-context fallback.

## Counts

- ~185 frontend endpoint patterns classified: MATCH ~172 · PARTIAL ~8 · MISSING 1 (shows) ·
  INCOMPATIBLE 0 · OBSOLETE 1 (settings/pipeline) · EXTRA ~20.
- Phase 5 live verification (2026-09-12): projects/shots/tasks pages + shot archive/restore
  lifecycle confirmed against real Django with MSW disabled. Backend suite 1842 passed / 1 skipped.
- Flips this pass (Phase 3): automations rules/logs, scheduling capacity/overbooking/resolve,
  saved/recent search (×2 routes) → MATCH (4 rows). Earlier flips retained: refresh rotation,
  Person scoping, activity alias, deliveries/publishing vocab (×2), master-data platform + org (×2).
- Reports + notifications flipped to MATCH (Phase: platform app). Remaining PARTIAL:
  global search, AI suite, analytics (prod + intel domain) — DOCUMENTED-STUB.
- Prior MATRIX corrections retained: refresh (was Match), Person scoping (was Compatible),
  publishing/deliveries (were Compatible), master-data (was unlisted); plus this pass:
  attachments compat (was MISMATCH in inventory — compat is bare array, MATCH).
