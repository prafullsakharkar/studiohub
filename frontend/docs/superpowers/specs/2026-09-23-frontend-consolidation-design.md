# Frontend Functionality Consolidation — Design (Option B)

Date: 2026-09-23
Status: Approved (approach B — scoped workspace consolidation)
Scope: StudioHub React frontend (`src/modules`, `src/pages`, `src/routes`, `src/components`, `src/core`, `src/features`, `src/api`, `src/mocks`)

## 1. Intent & understanding

Organize StudioHub around user intent -> business responsibility -> canonical workspace -> shared components -> shared API/data layer.

Agreed rulings from brainstorming:
- `/testing` is a frontend QA runner (`src/pages/TestingPage.tsx`: TestRunnerEngine matrix, coverage, error-lab, history, admin-only). `/platform/health` + `/api-health` both render `ApiHealthPage` -> `ApiHealthDashboard` (live endpoint/service telemetry, probing, chaos simulator). KEEP SEPARATE. Fix aliases + cross-links only.
- RBAC -> single global entry (`/access` + org-scoped `/organizations/:id/access/:section`, `AccessWorkspacePage` 8 tabs). Drop `/permissions` and `/settings/permissions`.
- Audit (8 pages) -> group into 2-3 workspaces, not 8 scattered routes, not 1 mega-page.
- Settings -> merge into Platform Admin (`/platform/admin/:tab`). `/settings` redirects.

Non-goals: no blind merges; no weakened RBAC; no cross-org leaks; no mock/rest forks.

## 2. Route canonical map + redirects

### 2.1 Health vs QA (kept separate)

| Current | Decision | Canonical |
|---|---|---|
| `/platform/health` | KEEP (canonical live telemetry) | `/platform/health` |
| `/api-health` | REDIRECT | `/platform/health` |
| `/testing` | KEEP (QA runner, admin-only) | `/testing` |

- `platformRoutes.tsx`: replace `/api-health` Route with `<Route path="/api-health" element={<Navigate to="/platform/health" replace />} />`.
- `PlatformAdminPage`: existing `tab === 'api-health'` -> navigate `/platform/health` stays.
- Cross-links: `ApiHealthPage` header adds "Open QA Runner" (-> `/testing`); `TestingPage` header adds "View Live Services" (-> `/platform/health`).
- Preserve deep state where practical (e.g. health `?category=` / `?endpoint=` pass through on redirect).

### 2.2 RBAC single entry

| Current | Decision | Canonical |
|---|---|---|
| `/access`, `/access/:section` | KEEP | `/access` workspace |
| `/organizations/:organizationId/access`, `/:section` | KEEP (org-scoped) | same workspace, org context |
| `/permissions`, `/settings/permissions` | REDIRECT -> `/access` | `/access` |
| `RolesSecurityPage` (`/permissions` impl) | REMOVE after migration | — |
| `SettingsPage` RBAC tab (`rbac`) | REMOVE (tab + `PermissionMatrix` import there) | — |

- `AppRoutes.tsx`: `/permissions` Route element becomes `<Navigate to="/access" replace />` (keep `PermissionRoute` guard so unauthorized still hits `/forbidden`).
- Shared impl: `PermissionMatrix`, `RoleEditorModal`, `AccessOverviewSection`, `RolesWorkspaceSection`, `UserAccessSection`, `GroupsManagementSection`, `PermissionsCatalogSection`, `ProjectAccessSection`, `PermissionSimulatorSection`, `AccessAuditSection` with explicit `scope: 'platform' | 'org'` + `organizationId`. No hardcoded tenant fallback.
- `RolesSecurityPage.tsx` deleted; `SettingsPage.tsx` drops `rbac` tab value, `canViewRbac` block, `PermissionMatrix` import.

### 2.3 Audit grouped into 3 workspaces

Existing: `auditRoutes.tsx` — `/audit`, `/audit-logs` (same), `/activity`, `/activities` (same), `/api-requests`, `/jobs`, `/background-jobs` (same), `/change-logs`, `/error-logs`, `/login-history`, `/tracks`.

| Group | Canonical route | Tabs (existing pages as tab panels) |
|---|---|---|
| Audit & Activity | `/audit` | audit-logs (`AuditLogsPage`), activity (`ActivitiesPage`) |
| System Logs | `/system-logs` (new) | api-requests (`ApiRequestsPage`), error-logs (`ErrorLogsPage`), change-logs (`ChangeLogsPage`), login-history (`LoginHistoryPage`) |
| Jobs & Tracks | `/jobs` | background-jobs (`BackgroundJobsPage`), tracks (`TracksPage`) |

- New wrappers: `AuditWorkspacePage`, `SystemLogsWorkspacePage`, `JobsWorkspacePage` (thin tab shells reading `?tab=` / `:tab`, rendering existing page components).
- Redirects (preserve `?tab=` / search params): `/audit-logs` -> `/audit?tab=audit-logs`; `/activity`, `/activities` -> `/audit?tab=activity`; `/api-requests`, `/error-logs`, `/change-logs`, `/login-history` -> `/system-logs?tab=<name>`; `/background-jobs` -> `/jobs?tab=background-jobs`; `/tracks` -> `/jobs?tab=tracks` (or keep `/tracks` canonical if deep links widespread — decide in plan; default redirect to `/jobs`).
- `auditRoutePaths` export updated; `PermissionRoute` permissions preserved per tab (`audit.view`, `activity.view`, `api_requests.view`, `error_logs.view`, `change_logs.view`, `login_history.view`, `background_jobs.view`, `tracks.view`).

### 2.4 Platform Admin absorbs Settings

| Current | Decision | Canonical |
|---|---|---|
| `/platform/admin`, `/platform/admin/:tab` | KEEP + extend tabs | `/platform/admin/:tab` |
| `/platform/master-data`, `/:tab` | REDIRECT -> `/platform/admin/:tab` | `/platform/admin/:tab` |
| `/settings` | REDIRECT -> `/platform/admin/pipeline` | `/platform/admin/pipeline` |
| `SettingsPage` (pipeline/theme/layout/database) | MOVE tabs into `PlatformAdminPage`, then REMOVE | — |

- New admin tabs: `pipeline`, `theme`, `layout`, `database` reusing `SettingsPage` sections (`ThemeEditorSection`, `LayoutSettingsSection`, `DatabaseSchemaSection`, pipeline form) as tab panels.
- `VALID_ADMIN_TABS` extended accordingly; unknown slugs fall back to `overview` (existing behavior).
- Guards: keep `platform.admin.view` / `master_data.view` / `software.view` / `status.view` `requireAny`; pipeline/database tabs additionally require `settings.view` / `platform.admin.view`.

### 2.5 Other alias dedupes (no behavior change)

- `/scheduling` canonical; `/calendar` -> redirect.
- Project/shot/asset nested aliases (`/projects/:id/assets`, org/project/show variants) untouched — out of scope, already resolve to same workspace with context.

## 3. RBAC + org/project/show scope preservation

- Preserve `AccessWorkspacePage` guards verbatim: `urlOrgMismatch` deny, `OrganizationRoute` current-org resolution, per-tab `can(permission)` filtering (`security.view`, `people.view`, `roles.view`, `group.view`, `project.view`, `permissions.manage`, `audit.view`), `can('roles.create')` for Create Role.
- No `isAdmin` / role-name checks. No `isUserAdmin` introductions. `SettingsPage` currently uses `isSuperOrAdmin` role-name check — removal via Admin merge must replace with `can()` evaluator, not propagate the pattern.
- Org isolation: every query uses active org id (`useOrganization`); audit workspaces filter by org; never display Org B data in Org A context.
- Project/show scope: `ProjectRoute` + `ProjectWorkspacePage` tab routing untouched.

## 4. Shared components vs shared pages

Canonical components (one impl, `scope` prop where needed):
`AccessManagement`, `PermissionMatrix`, `RoleEditorModal`, `EntityPermissions`, `ApiHealthDashboard` (+ `ServiceCard`, `LatencyTrendChart`, `EndpointDetailModal`, `ChaosSimulatorModal`), `AuditTimeline` / `ActivityTimeline`, `ErrorLogViewer`, `JobMonitor`, `ApiRequestViewer`.

Delete after migration: `RolesSecurityPage`, `SettingsPage` (after tab move), duplicate `PlatformPermissionTable` / `OrganizationPermissionTable` style splits if found (use config/scope instead). Verify via `query_graph pattern=tests_for` + grep before deletion.

## 5. Canonical data/API layer

- Keep hooks/keys stable: `useApiHealth`, `useAudit*` (`AUDIT_QUERY_KEYS`, `API_REQUESTS_QUERY_KEYS`, etc.), `useAccessManagementStore`, `useMasterData`, `usePlatformStats`. No key renames (avoids cache invalidation churn).
- Pages -> hooks -> services (`auditServices`, `ApiHealth` probe) stays. No duplicated fetch logic in new workspace shells.
- Mock + REST: same contracts for `VITE_API_MODE=mock|rest`. Update MSW handlers / mock data only for renamed routes; no forked feature impls. Update schemas/types/query-keys docs if routes affect them (they should not — route-only change).

## 6. Navigation updates

`Sidebar.tsx`, `Header`, command palette, breadcrumbs, workspace tabs, quick actions, context menus, dashboard links, internal links:
- One entry each: Access & RBAC (`/access`), API Health (`/platform/health`), QA Runner (`/testing`, admin-only), Audit & Activity (`/audit`), System Logs (`/system-logs`), Jobs & Tracks (`/jobs`), Platform Admin (`/platform/admin`).
- Remove: Permissions (`/permissions`), Settings (`/settings`), Master Data (`/platform/master-data`), API Health dup (`/api-health`), Calendar dup (`/calendar`), audit alias entries.
- Labels clarify: "API Health — Live Services" vs "QA Runner — Test Suites".

## 7. Phased rollout (redirects first, deletions after verification)

Phase 0 — Docs: `docs/frontend/FUNCTIONALITY_CONSOLIDATION_PLAN.md`, `FUNCTIONALITY_CONSOLIDATION_MATRIX.md` (KEEP/MERGE/MOVE/RENAME/REDIRECT/REMOVE/SHARED COMPONENT per page).
Phase 1 — Redirects + shells (no deletions): add `Navigate` redirects, new workspace shells, nav updates, cross-links.
Phase 2 — Consolidate: move Settings tabs into Admin, point imports at canonical components.
Phase 3 — Remove: delete `RolesSecurityPage`, `SettingsPage`, alias routes, unused nav/permission entries, duplicate mocks/handlers. `detect_changes` + `get_impact_radius` before each deletion.
Phase 4 — Report: `docs/frontend/FUNCTIONALITY_CONSOLIDATION_REPORT.md` (before/after counts) + Playwright regression.

## 8. Verification

Per consolidated area: navigation, route access, RBAC allow/deny, CRUD/actions, filters/search/pagination, workspace state, org context + isolation (A vs B), API calls (mock + rest), loading/empty/error states, audit/activity wiring, old-URL redirects with tab/state preserved.
Commands: `tsc --noEmit`, lint (biome), build, affected unit tests, Playwright (access RBAC matrix, health probe, audit tabs, redirects, no-duplicate-nav).

## 9. Risks

- User chose single global RBAC page: risk of conflating platform vs org scope. Mitigated by keeping both `/access` route variants + `scope` prop + `urlOrgMismatch` guard + `can()` checks.
- Audit grouping changes bookmarks: mitigated by param-preserving redirects.
- Settings merge touches `isSuperOrAdmin` role-name check: must not propagate; use `can()` in Admin.
