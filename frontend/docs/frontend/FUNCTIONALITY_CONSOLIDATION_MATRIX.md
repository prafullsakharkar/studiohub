# Functionality Consolidation Matrix

Source of truth for canonical locations. Verified against source 2026-09-23.
Spec: `docs/superpowers/specs/2026-09-23-frontend-consolidation-design.md`.

| Current | Related | Decision | Canonical Location |
|---|---|---|---|
| `/platform/health` | `/api-health` | KEEP (canonical live telemetry, `ApiHealthPage`) | Live Services Health |
| `/api-health` | `/platform/health` | REDIRECT → `/platform/health` (same page today) | `/platform/health` |
| `/testing` | none — QA runner (`TestingPage.tsx`, TestRunnerEngine matrix/coverage/error-lab/history, admin-only) | KEEP + cross-link to health (no merge) | `/testing` |
| `/permissions` | `/access` | REDIRECT → `/access`; REMOVE `RolesSecurityPage` | Access & RBAC workspace |
| `/settings/permissions` | `/access` | REDIRECT → `/access` | Access & RBAC workspace |
| `/access`, `/access/:section` | `/permissions` | KEEP (global entry, resolves org via context) | `/access` |
| `/organizations/:organizationId/access`, `/:section` | `/permissions` | KEEP (org-scoped, 8 tabs, `urlOrgMismatch` guard) | Org Access & RBAC |
| `/settings` | `/platform/admin` | REDIRECT → `/platform/admin/pipeline`; MOVE pipeline/theme/layout/database tabs; REMOVE page | `/platform/admin` |
| `/platform/admin`, `/platform/admin/:tab` | `/settings`, `/platform/master-data` | KEEP + extend tabs | `/platform/admin` |
| `/platform/master-data`, `/:tab` | `/platform/admin` | REDIRECT → `/platform/admin/:tab` | `/platform/admin` |
| `/audit` | activity/logs | KEEP → Audit & Activity workspace | `/audit` |
| `/audit-logs` | `/audit` | REDIRECT → `/audit?tab=audit-logs` | `/audit` |
| `/activity`, `/activities` | `/audit` | REDIRECT → `/audit?tab=activity` | `/audit` |
| `/api-requests` | logs | MOVE tab → `/system-logs` | `/system-logs` |
| `/error-logs` | logs | MOVE tab → `/system-logs` | `/system-logs` |
| `/change-logs` | logs | MOVE tab → `/system-logs` | `/system-logs` |
| `/login-history` | logs | MOVE tab → `/system-logs` | `/system-logs` |
| `/jobs` | tracks | KEEP → Jobs & Tracks workspace | `/jobs` |
| `/background-jobs` | `/jobs` | REDIRECT → `/jobs?tab=background-jobs` | `/jobs` |
| `/tracks` | `/jobs` | MOVE tab → `/jobs?tab=tracks` | `/jobs` |
| `/scheduling` | `/calendar` | KEEP | `/scheduling` |
| `/calendar` | `/scheduling` | REDIRECT → `/scheduling` (same `SchedulingPage`) | `/scheduling` |

## Shared components (one implementation, scope prop where needed)

`PermissionMatrix`, `RoleEditorModal`, `AccessOverviewSection`, `RolesWorkspaceSection`,
`UserAccessSection`, `GroupsManagementSection`, `PermissionsCatalogSection`,
`ProjectAccessSection`, `PermissionSimulatorSection`, `AccessAuditSection`,
`ApiHealthDashboard` (+ `ServiceCard`, `LatencyTrendChart`, `EndpointDetailModal`,
`ChaosSimulatorModal`), `AuditTimeline` / `ActivityTimeline`, `ThemeEditorSection`,
`LayoutSettingsSection`, `DatabaseSchemaSection`.

## Scope rules

- Same functionality + same scope → merge pages.
- Same functionality + different scope (platform RBAC vs org RBAC) → separate routes, shared implementation with `scope` + `organizationId`, never a hardcoded tenant fallback.
