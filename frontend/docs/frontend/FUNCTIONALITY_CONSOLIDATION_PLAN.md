# Functionality Consolidation Plan

Spec: `docs/superpowers/specs/2026-09-23-frontend-consolidation-design.md`.
Matrix: `docs/frontend/FUNCTIONALITY_CONSOLIDATION_MATRIX.md`.

## Principle

One obvious place per responsibility. Merge same-scope duplicates; share
implementation across different scopes with explicit `scope` + context.

## Route map

- Health (live telemetry) canonical `/platform/health`; `/api-health` redirects.
  `/testing` (QA runner) stays separate; pages cross-link.
- RBAC single entry `/access` (+ org-scoped `/organizations/:id/access/:section`,
  8 tabs). `/permissions` + `/settings/permissions` redirect; `RolesSecurityPage`
  removed; `SettingsPage` RBAC tab removed.
- Audit grouped: `/audit` (audit-logs, activity), `/system-logs` (api-requests,
  error-logs, change-logs, login-history), `/jobs` (background-jobs, tracks).
  Legacy paths redirect with `?tab=` and preserved search params.
- Platform Admin absorbs Settings: `/platform/admin/:tab` gains pipeline, theme,
  layout, database. `/platform/master-data*` redirects; `/settings` redirects to
  `/platform/admin/pipeline`. `SettingsPage` removed after the move.
- `/calendar` redirects to `/scheduling`.

## Workspaces and tabs

- Access & RBAC: overview, users, roles, groups, permissions, projects, simulator, audit.
- Audit & Activity (`/audit`): audit-logs, activity.
- System Logs (`/system-logs`): api-requests, error-logs, change-logs, login-history.
- Jobs & Tracks (`/jobs`): background-jobs, tracks.
- Platform Admin (`/platform/admin`): overview, software, statuses, task-types,
  asset-shot-types, review-file-types, roles/org-structure, pipeline, theme, layout, database.

## Shared components and data layer

Canonical components listed in the Matrix. Hooks and query keys stay stable
(`useApiHealth`, `useAudit*`, `AUDIT_QUERY_KEYS`, `API_REQUESTS_QUERY_KEYS`,
`useAccessManagementStore`, `useMasterData`, `usePlatformStats`). Workspace shells
are thin tab routers; no duplicated fetch logic. Same contracts for
`VITE_API_MODE=mock` and `rest`; MSW handlers updated in place.

## Permissions and isolation

Keep every `PermissionRoute` guard and per-tab `can()` check. Keep the
`urlOrgMismatch` deny. Replace the `SettingsPage` `isSuperOrAdmin` role-name gate
with `can()` during the Admin move. All org queries use the active org context.

## Rollout

1. Redirects + shells first (no deletions).
2. Move Settings tabs into Admin; point imports at canonical components.
3. Delete obsolete pages/routes/nav entries/mocks; verify impact radius first.
4. Report counts in `FUNCTIONALITY_CONSOLIDATION_REPORT.md`; run regression.

## Verification checklist

Navigation, route access, RBAC allow/deny, CRUD/actions, filters/search/pagination,
workspace state, org context + isolation (A vs B), API calls (mock + rest),
loading/empty/error states, audit/activity wiring, old-URL redirects with tab/state,
`tsc --noEmit`, Biome, build, unit tests, redirect regression tests.
