# Frontend RBAC Navigation & Action Gating (cross-cutting)

## Scope
Frontend-only permission refactor: make navigation, org switcher, command palette, and critical action buttons permission-driven rather than hard-coded role checks. User selected "Cross-cutting + CRITICAL gaps" slice. Backend untouched.

## Key Lesson: Audit subagents read STALE file versions
A 3-agent `explore` audit flagged hard-coded role bypasses in files that had ALREADY been refactored to permission-based checks. Verify each finding against the current file before editing:
- `src/layouts/OrganizationSwitcher.tsx` — ALREADY permission-aware: `canSwitchOrg`, `canCreateOrg` (superuser || can('organization.create')), `canViewDirectory` (superuser || can('organization.view') || can('page.organizations')), and non-superusers only see `userOrganizations`. No change needed.
- `src/modules/reviews/components/workspace/ReviewHeader.tsx` — ALREADY gated with `can('review.approve'|'review.close'|'review.update'|'review.manage'|'review.submit'|'review.create'|'review.status'|'review.action')` + superuser/platform-admin bypass. The hard-coded `role === 'Platform Admin'|'Organization Admin'|'VFX Supervisor'|'Lead Artist'` check from the audit is NOT present. No change needed.

## Changes Made (this session)
1. `src/shared/components/CommandPalette.tsx` — added `ENTITY_VIEW_PERMISSION: Partial<Record<EntityType,string>>` map (organization.view, client.view, vendor.view, people.view, department.view, team.view, office.view, project.view, shot.view, asset.view, task.view, version.view, review.view). Added `canRunCommand(perm?)` + `canViewEntityType(type)` callbacks (superuser/Platform Admin/Organization Owner bypass + `evaluateUserPermission` + store `hasPermission`). `searchResults` filters allowedTypes; `filteredCommands` + `executeItem` use the callbacks (defense-in-depth). Gated commands: `cmd-sys-mock-db-inspector`→platform.admin.view; `cmd-nav-global-search`→page.search; knowledge→page.knowledge; ai→page.ai; analytics→analytics.view; integrations→integrations.view; automations→automations.view; testing→page.testing.
2. `src/layouts/Sidebar.tsx` — removed hard-coded `if (item.id === 'testing') return true;` bypass so it respects its declared `page.testing` permission (matches route registry). Kept superuser/platform-admin and org-owner bypasses (org-owner is redundant-but-harmless; `evaluateUserPermission` rbac.ts:314 already grants org-owners org-scope).
3. `src/modules/organization/pages/PeoplePage.tsx` — added `useAuth().can`. Guarded handlers (`handleStatusChange`→people.update, `handleDelete`→people.delete) AND buttons (Invite→people.create, Edit→people.update, status toggle→people.update, Delete→people.delete) in both card + table views.

## Permission names (verified in permissionCatalog.ts)
people.view/create/update/archive/restore/delete (390-395); page.search(364); page.testing(373); page.platform_admin(594); department.view(398); team.view(405). page.knowledge/page.ai/page.analytics/page.integrations/page.automations are registry-ONLY (not in catalog).

## Test safety
`__tests__/test-utils.tsx` `AllTheProviders` renders superuser with `permissions:['*']`; `hasPermission` returns true for `'*'`. All rbac.ts helpers bypass `is_superuser`/wildcard (rbac.ts:148-150,187,270-271,310,384). So permission gates never fire in tests → no regressions.

## Second batch (pushed be59259) — action mutation guards
Added defense-in-depth permission guards on critical action MUTATIONS (not just buttons) in Reviews/Tasks/Deliveries:
- `ReviewWorkspace.tsx` — `canApprove` (review.approve|action|update) and `canManageReview` (review.update|manage|status) guard `handleConfirmVerdict` for approve/reject/requestChanges.
- `TasksPage.tsx` — `can('task.update'|'task.delete'|'task.bulk_update')` guard `handleUpdateTask`/`handleDeleteTask`/`handleBulkAssign`.
- `TaskDetailPage.tsx` — `can('task.update'|'task.delete')` guard `handleUpdate`/`handleArchiveToggle`/`handleDelete`.
- `TimelogsPage.tsx` + `TaskTimelogsTab.tsx` — guard `handleDelete` with `can('task.update')` (no `timelog.*` perm exists in catalog; timelog delete modifies a task's logged hours).
- `DeliveryWorkspacePage.tsx` — wrapped all 10 actions in `guarded*` wrappers gated by `delivery.create/update/submit/approve/reject/publish`.
IMPORTANT PATTERN: guarded wrappers must forward args with the SAME signature as the underlying hook action (approve(actorName?,notes?), reject(reason,notes,actorName?), cancel(reason,actorName?), addVersion(version), prepare/validate/submit/retry/complete(actorName?)). Modals call actions with `id` as the FIRST arg (pre-existing quirk, e.g. DeliveryApprovalModal `onApprove(id, actorName, notes)`), so match the hook signature, not the modal prop type, to preserve exact runtime behavior.
Verification: tsc clean, tests 17 pre-existing failures / 184 passed, pushed to origin/main.

## Third batch (pushed 871b801) — publishing + reviews
- `PublishingPage.tsx` — added `useAuth().can` + `guardedPublish`/`guardedRepublish`/`guardedUnpublish`/`guardedValidate`/`guardedRetry`. `onPublish`→`delivery.publish`; `onConfirm`(republish)→`delivery.publish`; `onConfirm`(unpublish)→`delivery.update`; `onValidate`/`onRetry`→`delivery.update`. `onRepublish`/`onUnpublish` props only open modals (setRepublishItem/setUnpublishItem) so left ungated; enforcement at guarded onConfirm. No `publishing.*` perm exists in catalog → reused `delivery.publish`/`delivery.update`. Signatures matched hook defs (publish(data), republish(id,comment,artistName), unpublish(id,reason,userName), validate(id), retry(id)).
- `ReviewsPage.tsx` — imported `Can` from `@/core/permissions/Can`; wrapped New Review / New Screening Reel buttons in `<Can permission="review.create">`; added `if (!can('review.create')) return;` guards in createReview/createPlaylist onSubmit handlers.

## ROUTE-LEVEL ENFORCEMENT — DO NOT APPLY GLOBALLY (verified blocker)
A registry-driven guard is UNSAFE to wire globally. `evaluateRouteAccess` (routePermissionsRegistry.ts) requires route `pagePermission` AND resource `permissions` (sequential `.every` unless requireAny). But many registry-referenced permissions DO NOT EXIST in `permissionCatalog.ts` or `systemRoles.ts` (verified):
- `timelog.view`, `workflow.view`, `analytics.view`, `integrations.view`, `automations.view` → catalog=0, roles=0
- `page.project.timelogs`, `page.project.publishing`, `page.project.workflow`, `page.project.calendar`, `page.project.tracks`, `page.project.playlists`, `page.analytics`, `page.integrations`, `page.automations` → catalog=0, roles=0
- `page.search` → catalog=1 but roles=0
Global guard would BLOCK every non-superuser from `/timelogs`, `/publishing`, `/workflows`, `/analytics`, `/integrations`, `/automations`, `/search`. Tests render superuser (bypassed) so they would NOT catch this. Correct path: fix the permission data model (add missing perms to catalog + grant in roles, or prune registry) as a SEPARATE pass before any global route guard. A temporary `RoutePermissionGuard.tsx` was created then DELETED (unused).

## Verification
- `tsc --noEmit` (lint/typecheck): clean.
- `pnpm test` (vitest run): 184 pass / 17 fail. All 17 failures are PRE-EXISTING and unrelated (OrganizationWorkspacePage, ProjectWorkspace, Reviews/ResizeObserver, CriticalJourneys) — confirmed by `git stash` rerun showing identical 17/184.
- `vite build`: succeeds (pre-existing chunk-size/dynamic-import warnings only).

## Tooling
`rg` unavailable → use `grep -rn`. Run tools via `./node_modules/.bin/<tool>`. No eslint configured; lint==typecheck==`tsc --noEmit`. Note: `pnpm test -- <paths>` still runs all 52 files (did not restrict), so compare full counts.

## Still open
- Route-level enforcement (direct-URL) remains BLOCKED — see the "DO NOT APPLY GLOBALLY" note above. Requires fixing the permission data model (missing catalog/role perms) first.
- Publishing module and ReviewsPage now done (batch 3). `ReviewVerdictModal.tsx` verified: its onConfirm → ReviewWorkspace.handleConfirmVerdict (already gated in batch 2), so no separate gate needed.
