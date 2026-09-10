# Epic: Show / Production Context & Isolation

## 1. Objective

Enforce a strict context hierarchy so production entity data is visible only
under an explicitly selected, authorized Show:

```text
Authenticated User → Organization → Project → Show → Production Entities
```

Fundamental rule:

> **Organization selection does not imply Project production access, and
> Project selection does not imply Show production access. Production data
> must remain hidden until the user has a valid, authorized Show context.**

Scope note: this workspace (`studiohub` repo) owns the **backend** phases.
Frontend work lives in the sibling `studiohub-react` repo and is specified
here as reported scope with file:line pointers — it is not edited from this
workspace.

## 2. Baseline audit (2026-09-10)

### 2.1 Backend: no Show domain exists

`backend/apps/production/` contains 14 models (`Project, Sequence, Shot,
Asset, Task, Timelog, Version, Review, Media, Playlist, Workflow,
ProjectMembership, EditorialCut, ProjectNote`) — no `Show`. All entities
carry only `organization` + `project` FKs. No Show migration, selector,
service, viewset, serializer, filterset, permission, or ADR exists
(`docs/adr/ADR-0001..ADR-0031` checked).

Current auth model (correct, to extend — not replace):

- `backend/apps/production/api/views/project_scoped.py` (`ProjectScopeMixin`):
  org → project resolution, then membership gate. Unknown org/project → 404,
  non-member → 403, fail-closed scoping. (Minor: line 151 error message says
  `Project {lookup}` for an org failure — copy-paste bug, fix in Phase 2.)
- Flat entities (`api/viewsets/base.py:18-145`): `IsAuthenticatedPermission` +
  `HasPermission`, fail-closed `scope_by_request`.
- Org URL/header resolution is centralized in
  `apps/organization/selectors/organization.py::resolve_by_lookup` (UUID →
  code/slug → frontend mock-id aliases), consumed by `NestedOrganizationMixin`
  (`api/viewsets/legacy.py`), `ProjectScopeMixin` (`production/api/views/
  project_scoped.py`), and the org-context middleware. Status: implemented and
  verified (selector + contract-compat + org-context suites, 64 passed) but
  **uncommitted in the working tree** — committing it is a Phase 0 exit item.
  Show resolution must follow the same pattern.

### 2.2 Frontend: skeleton exists, isolation leaks (reported, sibling repo)

Base path: `studiohub-react/src/`. `ProductionContext`, `ShowSwitcher`,
`ProductionContextGuard`, and show-scoped query keys for the 6 main entities
exist, but the audit found:

| # | Gap | Evidence |
|---|-----|----------|
| F1 | 5 behaviors auto-establish context | `layouts/ProjectSwitcher.tsx:52,60-70,123-125` (first-project + first-show auto-pick); `core/production/useProductionStore.ts:23,84-88` (persisted `activeProjectId: 'proj-001'`, org-reset picks first project) |
| F2 | ~14 hooks with unscoped query keys | `modules/media/hooks/useMedia.ts`, `modules/attachments/hooks/useAttachments.ts`, `modules/playlists/hooks/usePlaylists.ts`, `modules/workflows/hooks/useWorkflows.ts`, `modules/tasks/hooks/useTimelogs.ts`, `modules/audit/hooks/useAuditLogs.ts`, `modules/production/hooks/useProjects.ts`/`useProject.ts`, dashboard org query — bare keys (`['media','list',…]`), no `showId`, no `enabled` gate |
| F3 | MSW enforces nothing | `mocks/handlers/showHandlers.ts` (no 401/403 anywhere); `projectScopedHandlers.ts` (0/16 filter by show; `deliveries/schedule/resources/pipeline/files/activity` lack even 403; `resolveUserFromRequest` falls back to `mockUsers[0]`) |
| F4 | REST→mock fallback in UI | `layouts/ProjectSwitcher.tsx:34-37` (empty REST → mock list); `modules/assets/components/AssetTasksTab.tsx:62-63` (fabricated tasks) |
| F5 | ~12 pages unguarded | `ShotsPageCanonical` (dead guard import), `DashboardPage`, `ProjectWorkspacePage`, all `*WorkspacePage`, `PublishingPage`, search/analytics pages |
| F6 | `ShowSwitcher` reads all mocks directly | `layouts/ShowSwitcher.tsx:12,26-31` (`mockShows.filter`, no authorized fetch) — blocked on backend Phase 2 API |
| F7 | Search/palette/selectors are global | `CommandPalette.tsx:636-664`, `entityRegistry.ts:381-471` (`searchAllEntities`, no scope), `SearchService.ts` (no `show_id` in filters) |
| F8 | ~40 hardcoded `‖ 'org-apex-01'` / `‖ 'proj-001'` fallbacks | Switchers, tabs, modals, services, `mockRouter.ts`, handlers — silent context establishment |

## 3. Architecture decisions (require ADR before Phase 1)

Write `docs/adr/ADR-0032-show-production-context.md` covering:

1. **Show ownership:** `apps/production` owns `Show` as `organization` +
   `project` child, `unique_together = (project, code)` (mirrors
   `models/sequence.py:69`). Governs: ADR-0002/0003/0004/0008/0009/0010.
2. **Membership:** new `ShowMembership(org, project, show, user, role, scope,
   status)` mirroring `project_membership.py:18-61` (recommended — explicit
   per-level chain in §36) vs extending `ProjectMembership.scope`. Default
   authorization: DENY; chain Authentication → Org membership → Project
   membership → Show membership → permission → scope.
3. **Entity linkage (backward compat):** nullable `show` FK on the 12 entity
   tables + data backfill (default show per project), NOT a mandatory FK on
   day one (breaking). Downstream `unique_together` stays `(project, code)`
   until backfill completes; additive `(show, code)` index added.
4. **Lookup:** `ShowSelector.resolve_by_lookup(organization, project, lookup)`
   accepting UUID → `code__iexact` → mock-id alias (precedent:
   `OrganizationSelector.resolve_by_lookup`), reusing the existing
   `FRONTEND_MOCK_ID_TO_CODE` approach for `show-*` ids.
5. **Route contract (new, additive per ADR-0019):**
   `/api/organizations/<org>/projects/<project>/shows/` and
   `/api/organizations/<org>/projects/<project>/shows/<show>/<resource>`
   (`sequences|shots|assets|tasks|versions|reviews|editorial|notes|deliveries|
   schedule|resources|pipeline|files|activity|members|summary`). Existing
   project-scoped routes unchanged. Statuses: 401 unauthenticated,
   403 authenticated-but-unauthorized (incl. IDOR), 404 unknown
   org/project/show or valid-but-out-of-scope id (no existence oracle).
6. **Stub-data elimination (ADR-0029):** seed produces real rows; API never
   returns hard-coded mocks.

## 4. Phases — backend (this repo)

### Phase 0 — Baseline commit + ADR + contract doc

- Commit the pending org-resolution centralization (`resolve_by_lookup` +
  mock-id map + 3 call-site refactor + selector/contract tests) as the
  baseline the Show work builds on; re-run the 3 suites green.
- Write ADR-0032 (§3). Add `docs/apps/production/show.md` from
  `docs/APP_ARCHITECTURE_TEMPLATE.md`. Fix the `project_scoped.py:151`
  message bug (still present: org failure raises
  `Project {lookup} not found in organization`).
- Exit: baseline committed; ADR merged; contract reviewed.

### Phase 1 — Show/ShowMembership domain

New in `backend/apps/production/`: `models/show.py` (+`show_membership.py`),
`querysets/show.py`, `managers/show.py` (note: production `querysets/` and
`managers/` currently hold only `__init__.py` — create or document omission),
`selectors/show.py` (with `resolve_by_lookup` + `summary_counts`, mirroring
`selectors/project.py:15-57`), `services/show.py` (extend `BulkOperationService`
like `services/sequence.py:21-24`), `ShowPermissions` in
`constants/permissions.py`, `api/serializers/show/` (base/list/detail/create/
update/bulk), `api/filtersets/show.py`, `api/viewsets/show.py` (selector/
service/filterset/permission_map/search/ordering, mirroring
`api/viewsets/sequence.py:18-52`), `admin/show.py`, migration `0010`,
`ShowFactory`/`ShowMembershipFactory` in `tests/factories.py`, model/selector/
service/permission tests. Follow `apps/organization` (Department) as reference.
- Exit: `uv run python manage.py check` clean; domain tests pass; no API
  mounted yet.

### Phase 2 — Show-scoped nested API

- `api/views/show_scoped.py`: `ShowScopeMixin` (resolve org → project → show
  via selectors; 404/403 per §3.5; sets `request.organization/membership/show`
  + `_org_context_resolved`), entity views reusing flat viewsets'
  filterset/search/ordering/pagination via the `_entity_list` pattern from
  `project_scoped.py:209-247`, additionally filtered to the URL show.
- `api/urls_show_scoped.py` + mount in `config/api_urls.py` (slash-optional,
  mirroring `api/urls_project_scoped.py:30-60`). Flat `router.register("shows")`
  + project-nested `("shows", ProjectShowsView)`.
- `perform_create` show/org/project consistency validation, fail closed
  (precedent: `viewsets/base.py:110-145`).
- Seeder: `_seed_shows()` in `seed_production_mocks.py` keyed
  `(organization, project, code)`; note the seed path (`frontend/...`) is
  stale vs the sibling `studiohub-react` checkout — add `--mocks-dir` override.
- Exit: contract tests (authorized 200 / wrong-project 404 / other-org 404 /
  non-member 403 / unauthenticated 401-403 / missing show 404) green.

### Phase 3 — Entity show-FK + backfill

- Nullable `show` FK + indexes on the 12 entity models; backfill one default
  show per project; extend downstream selectors/serializers/filtersets
  (`select_related("show")`, `show` in search/ordering/filterset fields).
- Exit: migration applies cleanly on seeded dev DB; `seed_studiohub
  --validate-only` passes; existing suites green.

### Phase 4 — Backend isolation tests

- `tests/test_show_scoping.py` + `tests/test_show_membership.py` (mirror
  `test_organization_scoping.py:19-135`): Show A/B isolation, no-context
  denial, direct-URL IDOR (403), cross-org show (404), stale-membership
  revocation, soft-deleted/archived show handling.
- Exit: full `apps/production` + `apps/organization` suites pass.

## 5. Phases — frontend (reported, sibling repo `studiohub-react`)

- **Phase 5a — stop silent context:** remove F1 auto-picks (explicit `null`
  + `Select Show` state), drop F8 hardcoded fallbacks, fix F4 mock fallbacks
  (transport already forbids fallback: `api/repositories/config.ts:8`).
- **Phase 5b — query isolation:** F2 hooks adopt
  `['organizations', org, 'projects', proj, 'shows', show, <entity>]` +
  `enabled: Boolean(org && proj && show)`; route show pages through
  `ProjectScopedApiService` extended with `showId` path segments (§14).
- **Phase 5c — guards & empty states:** wrap F5 pages in
  `ProductionContextGuard`; dashboards render metrics only with show context.
- **Phase 5d — MSW parity:** F3 — 401 unauthenticated, 403 unauthorized show,
  404 wrong-project/org show, filter every handler by show; remove
  `mockUsers[0]` fallback and the `proj-001` activity leak.
- **Phase 5e — authorized Show source:** point `ShowSwitcher`/context at
  Phase-2 `GET .../shows` (replacing direct `mockShows` filter, F6); scope
  search/palette/selectors to show (F7); validate persisted context on restore
  (§25); TanStack invalidation on org→project→show→logout transitions (§18).

## 6. Acceptance mapping (spec §40)

Backend-complete when: show routes validate org+project+show+membership (§8,
§12, §13 → 401/403/404 per §3.5); entity lists are show-filtered server-side
(§14); no mock fallback exists in API (§16/§29); isolation tests prove A/B,
no-context, IDOR, cross-org, revocation cases (§37). Full acceptance
additionally requires Phase 5 (frontend): no auto-select (§26), centralized
selector/guard (§3, §29-31), scoped keys + disabled-no-show (§5-6, §17-18),
stale-data transitions (§10, §32), search/palette scoping (§20-21), persisted
validation (§25).

## 7. Non-goals / risks

- No changes to existing project-scoped routes (additive only).
- No mandatory entity `show` FK until backfill proves clean (Phase 3).
- Risk: entity tables are large — backfill must be batched; index on
  `(organization, project, show)` before enabling show filters in list views.
- Risk: frontend mock `project_id` join uses mock ids (`proj-001`) while
  sequences/shots use `project_code` — seeder must resolve both (see audit §d).
