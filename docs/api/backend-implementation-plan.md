# Backend Implementation Plan

Ordered plan to replace MSW with the real Django API without frontend changes.
Each phase ends with contract tests passing against both mock and real backends
(Phase J). Follow the existing architecture: HTTP → ViewSet → Serializer → Permission →
Service/Selector → Validator → Manager/QuerySet → Model, using `apps/organization` as
the reference implementation.

## Phase 0 — Contract Alignment (prerequisite, backend-side) ✅ COMPLETE

1. ✅ Raw DRF pagination `{count,next,previous,results}` (supports `page_size` + `limit`
   alias); no envelope wrapping on `/api/v1/*`.
2. ✅ Custom exception handler emits unwrapped DRF error bodies
   ([errors.md](errors.md)).
3. Bare-array serialization: N/A until legacy organization aliases (Phase C) and
   production endpoints (Phase D) exist — contract documented per endpoint.
4. ✅ Trailing-slash tolerance via `apps.core.middleware.TrailingSlashMiddleware`
   (resolves slash-appended paths pre-dispatch, all methods).
5. ✅ `rest_framework_simplejwt.token_blacklist` in INSTALLED_APPS;
   `JWTAuthentication` first in default authentication classes.
6. ✅ drf-spectacular wired: `/api/schema/` + Swagger UI; schema generates with
   **0 errors** (`manage.py spectacular`). Fixes made: permissive ordering filter field
   exposes `null_label`; declarative viewsets fall back to a mapped serializer when no
   action-specific serializer exists (schema introspection only); two MFA APIViews
   annotated with `@extend_schema`; removed invalid serializer field/exclude entries.

Known pre-existing failures NOT introduced by this phase (tracked separately): missing
`inactive()` manager/queryset methods across identity models, event-bus transaction
tests, soft-delete DB tests.

## Phase A — Core API Foundation ✅ COMPLETE

- ✅ Health endpoint confirmed at `GET /health/` → `{"status":"ok"}` (verified via test).
- ✅ Attachments path alias implemented: canonical `/api/v1/core/attachments/` + compat
  `/api/v1/attachments/` (same `AttachmentViewSet`) via `apps/core/api/urls_compat.py`.
  See [domains/core.md](domains/core.md).
- ✅ Shared filter/search/ordering mixins verified: `SearchFilterMixin` (icontains OR),
  `AnyFieldOrderingFilter` (`-field` syntax, permissive), `BooleanFilter` (`true`/`false`
  strings) — contract semantics match frontend `applyFiltersAndSearch`.
- ✅ Trailing-slash tolerance via `TrailingSlashMiddleware` (already Phase 0) verified for
  both prefixes.
- ✅ Seed-data command: `python manage.py seed_dev` (`apps/core/management/commands/seed_dev.py`)
  — idempotent (`get_or_create`), env-gated (`DEBUG` or `ALLOW_SEED=1` or `--force`),
  covers Org → Departments/Teams/Offices → Roles/Permissions → Users/Profiles/Memberships
  (password `password123`). Handles required fields (`department_type`, `office_type`),
  maps frontend permission codes to valid `PermissionModule` values, respects constraints.
  Local DB drift verified resolved: `organizations` has no `metadata` column (model has
  none), `org_department` columns match the model exactly, and a full model↔DB sweep shows
  no real drift (only implicit-`id` false positives on contrib tables).

Resolved: all organization factories updated to match post-0003 schema — `PersonFactory`
stripped to real fields (was setting 10 removed attrs), `DepartmentFactory` drops removed
`status`/`budget`/`budget_currency`, adds required `department_type`, defaults
`manager=None` (FK is to User, nullable); the circular `manager` → `PersonFactory` →
`DepartmentFactory` `RecursionError` is broken. A full factory audit fixed 21 broken
factories (wrong-model FKs, removed attrs, wrong choice cases, stale duplicate
`LoginHistoryFactory` now mirrors the canonical audit shape). Verified: every factory
`create()`s cleanly; suite 1450 passed, ruff clean.

## Phase B — Identity API ✅ CORE COMPLETE (auth compat + user payload); REMAINDER TRACKED

1. ✅ Route `/api/v1/auth/{login,refresh,logout,me}/` via `apps/identity/api/views/auth_compat.py`
   + `apps/identity/api/urls_auth_compat.py` (mounted at `auth/` in `config/v1_urls.py`).
   Responses adapted to `{tokens:{access,refresh}, user}` / `{access}` /
   `{detail}` / `FrontendUser`. Fixes: `JWTService.rotate_refresh_token` now resolves user via
   `api_settings.USER_ID_CLAIM` (was `refresh.user` AttributeError); import `SIMPLE_JWT` in
   `config/settings/base.py`; add missing `UserSessionValidator.validate_refresh/validate_logout`;
   set `JWTAuthentication` on `AuthMeView`/`AuthLogoutView` (was `authentication_classes=()`).
   Verified via 5 `pytest` contract tests (login/refresh/me + pagination alias + health).
2. User action gaps: **TRACKED** — `suspend`/`unsuspend`/`reset-password`/`force-password-change`/
   `revoke-sessions` not yet exposed; frontend `UserService` calls these but `identityHandlers.ts`
   is dead code (no live UI). Decision: add as `@action` on `UserViewSet` in follow-up, mapping to
   existing services (`UserService`/`PasswordService`/`TokenService.revoke`).
3. Sessions endpoints: **TRACKED** — `LogoutAllAPIView`/`LogoutOtherDevicesAPIView` exist but
   unrouted; frontend `SessionService` expects `/api/v1/identity/sessions/...` (dead code). Plan:
   route at `identity/sessions/` or `auth/sessions/` with `TokenService` and document.
4. Roles/Permissions: **DECIDED** — owner is **organization** app (`Role` has `organization` FK and
   `OrganizationEntityModel` base). Canonical is `/api/v1/organization/roles/` and
   `/permissions/`. Frontend's expectation at `/api/v1/identity/roles/` is legacy; provide either
   alias include (`identity/roles/` → same viewset) or migrate frontend to `organization` prefix.
   Extra actions (`clone`, `permissions/add|remove`) and permission filters (`module`/`category`/`codes`)
   remain **MISSING BACKEND** — add as `@action` on `RoleViewSet`/`PermissionViewSet` with `RolePermission` service.
5. ✅ Serializer emits frontend User payload via `apps/identity/api/serializers/frontend_user.py`:
   aggregates `User` + `Profile` + `OrganizationMembership` (with `X-Organization-Id` header support
   for active org) + `RolePermission` → `{id, email, first_name, last_name, full_name, avatar_url,
   role, permissions[], organization_id/name, department, is_active, is_staff, is_superuser,
   created_at, updated_at}`. Handles missing profile/membership gracefully.

## Phase C — Organization API ✅ COMPLETE

1. ✅ v2 actions: `OrganizationViewSet` now exposes `my`, `archive`, `restore`, `export`,
   `switch`, `organization_settings` (GET/PATCH via `OrganizationSettingsDetailSerializer`);
   `TeamViewSet` exposes `archive`, `transfer-ownership`, `members`, `members/add`,
   `members/remove`; `InvitationViewSet` exposes `resend`, `accept`, `decline`;
   `OrganizationMembershipViewSet` exposes `bulk-update` — all via `@action` with
   `permission_map` entries and service delegation (e.g., `OrganizationService.archive`,
   `TeamService`, `InvitationService`, fallback stubs where needed).
2. ✅ Legacy flat aliases at `/api/v1/{organizations,departments,teams,offices,people}/`
   via `apps/organization/api/urls_legacy.py` + `viewsets/legacy.py`:
   - `organizations/` conditional pagination (bare array unless `?page`/`?page_size`/`?limit`),
   - `departments`/`teams`/`offices` always bare array (`pagination_class=None`),
   - `people` paginated (`StandardPagination`),
   - all detail routes accept id-or-code (`code__iexact` fallback with UUID validation guard),
   - same selectors/services (no logic fork) + `LegacyOrganizationSingletonView` at
   `/api/v1/organization/` (first org for user).
3. ✅ People API on existing `Person` model: `PersonSelector`/`PersonService`,
   `PersonSerializer` (front-end compat fields with defaults), `PersonViewSet` at
   `/api/v1/organization/persons/` (v2) and `/api/v1/people/` (legacy). Verified paginated
   `PaginatedResponse<Person>` via contract test.
4. ✅ Clients/Vendors/Billing as MISSING MODELS documented in
   `domains/organization.md`: decision deferred to future `commercial`/`platform` apps
   (see mapping table); frontend `organizationApi` for those will remain MSW until then.
   Paginated v2 for `organizations/departments/teams/offices/persons/memberships/invitations`
   now uses `StandardPagination` (was `None` via `PaginationMixin`); legacy tests updated
   to handle paginated shape.
   UPDATE: Clients/Vendors now exist as real models + CRUD APIs
   (`/api/v1/clients/`, `/api/v1/vendors/`); Billing remains deferred.
5. ✅ Client/Vendor Contacts (F1a): `ClientContact`/`VendorContact` models
   (soft-delete, org FK, parent FK) with nested legacy routes
   `/api/v1/clients/{client_pk}/contacts/` and `/api/v1/vendors/{vendor_pk}/contacts/`
   (GET list / POST create / PATCH / DELETE). Parent + organization derived
   server-side (org-scoped parent lookup; 404 on missing parent); permissions reuse
   `OrganizationPermissions`; filtersets (`is_primary`, search over name/email/role);
   `seed_dev` seeds contacts from frontend mock data. Frontend tabs
   (`ClientContactsTab`, `VendorContactsTab`, `ClientContactSelect`, overview tabs)
   consume the real API via `useClientContacts`/`useVendorContacts` + mutations.

## Phase D — Production API ✅ COMPLETE (all slices via `apps.production`)

Design first (`docs/03-domain/`): Project, Sequence, Shot(+pipeline stages), Asset,
Task(+dependencies/schedule), Timelog, Version(+publishing info), ReviewSession(+notes/
comments/annotations), MediaItem, Playlist(+entries/share), Workflow(+nodes/transitions),
AutomationRule, Scheduling entities, Analytics selectors.

Implementation slices (each: models → migrations → serializers → selectors/services →
viewsets → filtersets → permissions → events → tests):
1. ✅ **Projects → Shots → Assets** (core production spine) — `apps.production` with
   `Project`/`Shot`/`Asset` models (org+project scoping, `StandardPagination`,
   `SearchFilter`/`OrderingFilter`, `IsAuthenticated`, `Shot.approve` action,
   denormalized `*_name` fields). Mounted at top-level `/api/v1/{projects,shots,assets}/`
   via `apps.production.api.urls` (added to `config/v1_urls.py` and `LOCAL_APPS`).
   Migrations `production.0001_initial` applied (testing DB). Contract tests for CRUD +
   approve pass.
2. ✅ **Tasks (+bulk actions) → Timelogs (+approve/reject)** — `Task`/`Timelog` models
   (`organization`+`project` scoping, `StandardPagination`, `SearchFilter`, bulk
   `bulk-assign`/`bulk-status`/`bulk-archive`/`bulk-delete` + `timelogs/{id}/approve|reject/`),
   migrations `0002_task_timelog`, verified via contract tests (paginated, filters).
3. ✅ **Versions + publishing flow** — `Version` model (`code`/`version_number`/`entity_*`,
   `shot`/`asset`/`task` FKs, `publishing_info` JSON, `is_published`/`is_hero`), `VersionViewSet`
   with `publish`/`unpublish`/`archive`/`promote`/`add-to-playlist` actions; divergent
   `PublishedVersion` vs `ProductionVersion` reconciled to `ProductionVersion` (richer).
4. ✅ **Reviews lifecycle** — `Review` model (title/code, `project`/`entity`, `status`/`verdict`,
   `versions`/`reviewers`/`comments`/`notes`/`annotations`/`activity` JSON), `ReviewViewSet`
   with `submit`/`start-review`/`approve`/`reject`/`request-changes`/`close`/`verdict`/
   `annotations`/`comments`/`comments/{id}/resolve|reopen`/`notes` actions.
5. ✅ **Playlists + Media** — `Playlist` (`entries`/`share_settings` JSON, bare-array) and
   `Media` (`entity_type`/`media_type`, bare-array) with `add-entry`/`remove-entry`/`reorder`/`share`/`archive`/`restore`
   (playlist) and CRUD (media).
6. ✅ **Workflows/Automations** — `Workflow` model (`nodes`/`transitions`/`automation_rules` JSON,
   `StandardPagination`) with `simulate` (dry-run), `clone`, `activate`/`deactivate`/`archive`;
   `Automation` stub at `/automations/rules/` + `/audit-logs/` (bare array, `GenericAPIView`).
7. ✅ **Scheduling + Analytics** — `Scheduling*` and `AnalyticsKpis` as `GenericAPIView` stubs
   (bare-array / object, `@extend_schema` + `DummySerializer`, `IsAuthenticated`) at
   `/scheduling/events|resources|capacity|overbooking|holidays|leaves/` and
   `/analytics/kpis|departments/`; no DB required, returns contract-shaped empty/stub data
   (frontend handles empty gracefully, avoids 404).

## Phase E — Authentication Integration (frontend switch prep)

- Same-origin deployment or reverse proxy for `/api/`, `/media/`, `/admin/`.
- Bypass strategy for the in-process mock router: single change in `ApiClient.ts`
  (no runtime flag exists today) — document exact diff before touching frontend.
- Verify `X-Organization-Id` handling end-to-end.

## Phase F — Permissions

- `permission_map` entries for every new viewset; object-level rules in services.
- Ensure login/me payloads surface `Permission.code` values matching UI strings
  (`module:action`).
- Consolidate `HasPermission` vs `RBACPermission` duplication (documented tech debt).

## Phase G — Filtering / Search / Pagination

- FilterSets per [filtering.md](filtering.md) using core mixins; multi-value CSV filters
  where required (`event_type`).
- Search annotations for denormalized `*_name` fields (N+1 safe).
- Parity tests: same param set against mock expectations.

## Phase H — Error Handling

- Domain exceptions mapped to statuses; 409 conflicts (duplicate code, state-machine
  violations); rate-limit middleware returns DRF-shaped bodies; 500 JSON guarantee.
- Contract fixtures for each status code consumed by both test suites.

## Phase I — Seed Data

- `seed_dev` management command covering Organization → Departments/Teams/Offices →
  Users/Roles → Projects/Shots/Assets/Tasks/Versions/Reviews per
  [api-contract.md](api-contract.md); repeatable, relationship- and constraint-respecting,
  development-only guard.

## Phase J — Contract Testing

- Shared scenario definitions (endpoint, method, request, expected status/shape) run
  against MSW (frontend/vitest) and Django (pytest + APIClient) — see
  `docs/09-testing/`.
- Golden files generated from drf-spectacular schema compared against the documented
  inventory in [api-contract.md](api-contract.md).

## Phase K — MSW → Django Switch

1. Frontend diff: remove `dispatchMockRequest` call from `ApiClient.ts` (keep files for
   rollback; do not delete MSW yet).
2. Smoke all modules; compare network traces against golden schema.
3. Remove mock router import permanently after one release cycle.

## Phase L — End-to-End Validation

- Full checklist from the task spec (auth flow, org switching, production CRUD, bulk ops,
  uploads when wired, error shapes, pagination edges).
- Performance sanity on paginated lists (annotations, select_related/prefetch_related).

## Explicitly Deferred

- Platform domain (`/platform/*`) — PLANNED, contract documented only.
- MFA UI reconciliation — PLANNED.
- Intelligence module HTTP wiring — frontend stays on local mocks: the backend
  intelligence endpoints exist as URL contracts but return stub/empty payloads
  (no models), so rewiring would regress the UI. Real implementation needs
  search-index + LLM-backed services first.
- Publish/delivery destinations — DONE (P2.2): real org-scoped CRUD at
  `/publishing/destinations/` and `/deliveries/destinations/`; frontend
  services rewired; deliveries + publishing + scheduling hooks converted to
  TanStack Query.
- Client/vendor project association tabs — DONE (P2.3): ClientProjectsTab and
  VendorProjectsTab resolve associations from the real project list
  (`useProjects`), keeping the existing fuzzy code/name matching and the real
  `updateClient`/`updateVendor` mutations.
- Remaining mock-backed tabs — contracts, invoices, purchase orders,
  activities, performance, teams, users, departments, selects, overview
  aggregates, and the USD/milestone/crew/activity/deliverable-shaped project
  tabs stay on local mocks: no backend models exist for those entities, and
  several mock shapes (VendorDelivery QC submissions, ProjectMilestone phases,
  ProjectCrewMember allocations) describe different entities than their
  same-named backend counterparts. Building those domains is feature work,
  not debt cleanup.
