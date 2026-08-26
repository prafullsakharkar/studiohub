# Backend Implementation Plan

Ordered plan to replace MSW with the real Django API without frontend changes.
Each phase ends with contract tests passing against both mock and real backends
(Phase J). Follow the existing architecture: HTTP → ViewSet → Serializer → Permission →
Service/Selector → Validator → Manager/QuerySet → Model, using `apps/organization` as
the reference implementation.

## Phase 0 — Contract Alignment (prerequisite, backend-side)

1. Replace default response behavior: raw DRF pagination `{count,next,previous,results}`
   (support `page_size` + `limit`), remove envelope wrapping for `/api/v1/*`
   ([pagination.md](pagination.md)).
2. Rewire the custom exception handler to emit unwrapped DRF error bodies
   ([errors.md](errors.md)).
3. Add bare-array serialization support for endpoints whose frontend contract requires it.
4. Add trailing-slash tolerance; wire drf-spectacular schema URLs (`/api/schema/`,
   Swagger UI) ([versioning.md](versioning.md)).
5. Add `rest_framework_simplejwt.token_blacklist` to INSTALLED_APPS;
   add `JWTAuthentication` to default authentication classes.

## Phase A — Core API Foundation

- Health endpoint confirmed; attachments path decision documented
  ([domains/core.md](domains/core.md)).
- Shared filter/search/ordering mixins verified against contract semantics
  (icontains search, `-field` ordering, boolean string coercion).
- Seed-data command skeleton: `python manage.py seed_dev` (idempotent, env-gated).

## Phase B — Identity API

1. Route `/api/v1/auth/{login,refresh,logout,me}/` adapting responses to
   `{tokens:{access,refresh}, user}` / `{access}` ([authentication.md](authentication.md)).
2. User action gaps: suspend/unsuspend/reset-password/force-password-change/revoke-sessions.
3. Sessions endpoints wired to `TokenService` (+ route logout-all/logout-other views).
4. Decide roles owner (identity vs organization app) then expose roles CRUD + clone +
   permission add/remove; permissions list with module/category/codes filters.
5. Serializer must emit the frontend user payload (`role` display string,
   `permissions[]` as `module:action`, organization fields).

## Phase C — Organization API

1. v2 actions: organization archive/restore/export/switch/settings; membership
   members/add, members/remove, transfer-ownership.
2. Legacy flat aliases at `/api/v1/{organizations,departments,teams,offices}/…`
   preserving conditional/bare-array pagination and id-or-code lookups — same
   selectors/services, no logic fork ([domains/organization.md](domains/organization.md)).
3. People API on existing `Person` model.
4. Document Clients/Vendors as MISSING MODELS; design CRM models or defer with an
   explicit decision record.

## Phase D — Production API

Design first (`docs/03-domain/`): Project, Sequence, Shot(+pipeline stages), Asset,
Task(+dependencies/schedule), Timelog, Version(+publishing info), ReviewSession(+notes/
comments/annotations), MediaItem, Playlist(+entries/share), Workflow(+nodes/transitions),
AutomationRule, Scheduling entities, Analytics selectors.

Implementation slices (each: models → migrations → serializers → selectors/services →
viewsets → filtersets → permissions → events → tests):
1. Projects → Shots → Assets (core production spine).
2. Tasks (+bulk actions in transactions) → Timelogs (+approve/reject).
3. Versions (resolve the two-shape divergence to `ProductionVersion`) + publishing flow.
4. Reviews lifecycle + sub-resources.
5. Playlists + media.
6. Workflows/automations (simulate dry-run writes audit log).
7. Scheduling + analytics read selectors.

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
- Intelligence module HTTP wiring — currently pure local mocks, no REST contract.
