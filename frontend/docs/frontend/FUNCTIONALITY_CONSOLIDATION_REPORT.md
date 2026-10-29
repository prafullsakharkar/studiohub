# Functionality Consolidation Report

Spec: `docs/superpowers/specs/2026-09-23-frontend-consolidation-design.md`.
Plan: `docs/superpowers/plans/2026-09-23-frontend-consolidation.md`.
Matrix: `docs/frontend/FUNCTIONALITY_CONSOLIDATION_MATRIX.md`.

## Counts (base `7105387` → HEAD)

- Sidebar nav items: 38 → 31 (−7: `/permissions`, `/settings`, 8 audit entries → 3 workspaces).
- `AppRoutes` route paths: 88 → 88 (same paths; renders replaced by `<Navigate>` redirects — zero dead routes).
- `platformRoutes` paths: 10 → 10 (`/api-health`, `/platform/master-data*` now redirects).
- `auditRoutes` paths: 11 → 12 (+1 canonical `/system-logs`; legacy kept as tab-preserving redirects).
- Pages removed: 2 (`RolesSecurityPage`, `SettingsPage`).
- Pages added: 3 thin shells (`AuditWorkspacePage`, `SystemLogsWorkspacePage`, `JobsWorkspacePage`).
- Duplicate hooks removed: 0 (hooks were already canonical; shells reuse `useAudit*`, `useApiHealth`, `useAccessManagementStore`).
- Duplicate API implementations removed: 0 (no forks existed; query keys unchanged).
- Duplicate mock handlers removed: 0 (MSW contracts unchanged — route-only change works in mock + rest).
- Unused permission entries removed: 0 (registry entries kept deliberately — see Task 5 ruling).

## Consolidations

- `/platform/health` + `/api-health` → canonical `/platform/health` (redirect). `/testing` kept separate (QA runner ≠ live telemetry) with cross-links both ways.
- `/permissions` + `/settings/permissions` + org access → canonical Access & RBAC (`/access`, `/organizations/:id/access/:section`); shared `PermissionMatrix`/`RoleEditorModal`/section set; `SettingsPage` RBAC tab removed.
- 8 audit pages → 3 workspaces: `/audit` (audit-logs, activity), `/system-logs` (api-requests, error-logs, change-logs, login-history), `/jobs` (background-jobs, tracks). Legacy paths redirect with `?tab=` + search params preserved.
- `/settings` → merged into `/platform/admin` (pipeline, theme, layout, database tabs). `/platform/master-data*` redirects. `SettingsPage` `isSuperOrAdmin` role-name gate replaced with `can()`.
- `/calendar` → `/scheduling` (redirect).

## Verification (2026-09-23, in-place on main)

- `npx vitest run`: 54 files, 371 tests, all pass (incl. 4 new redirect/workspace suites).
- `npx tsc --noEmit`: exit 0. `npx biome check src...`: exit 0. `npx vite build`: success (only pre-existing chunk-size warning).
- `grep useApiHealth src/pages/TestingPage.tsx`: clean (QA runner never polls telemetry).
- No remaining internal links to `/settings`, `/permissions`, `/api-health`, `/calendar` (verified by grep; legacy URLs redirect).
- Registry legacy entries intentionally kept (gating metadata, not routes).
- All redirects preserve `?search`/`#hash` via `PreserveQueryRedirect` (audit aliases additionally set `?tab=` via `TabRedirect`).
- Settings-scoped viewers (`settings.view`/`page.settings` without `platform.*`) keep pipeline/theme/layout access: admin route + registry exact entries + tab filtering with coercion to `/platform/admin/pipeline`. No client/vendor role holds settings perms (verified in `systemRoles.ts`).
- Playwright: scaffold only (`e2e/consolidation.spec.ts`) — harness not installed in repo; vitest structural redirect tests are the automated gate.

## Definition of Done

- [x] Entire frontend audited (routes, pages, workspaces, nav, palette, registry).
- [x] Consolidation matrix created; canonical chosen per capability.
- [x] Redundant tabs/nav entries removed (7 nav items).
- [x] Duplicate pages removed (2); shared components reused (no new forks).
- [x] Old routes redirect to canonical (param-preserving where tabs exist).
- [x] RBAC preserved (`can()` + `PermissionRoute`); org isolation guard untouched.
- [x] Mock + REST compatible (no contract changes).
- [x] TypeScript, lint, build, full unit suite green.
- [ ] Playwright suite running in CI (scaffold written; needs `@playwright/test` + config — follow-up).
