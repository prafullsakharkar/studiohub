# Phase 03 — Canonical Architecture (definition only, no refactoring performed)

Sources: Phase 01 inventory + Phase 02 redundancy matrix (2026-09-23).
Rule: one canonical implementation per responsibility, chosen from existing code.
No new abstraction is introduced below except where explicitly justified
(T1-2 generic bulk hook — no generic exists today).

Global preservation guarantees (apply to every area): mock mode and REST mode
keep working via `api/repositories/config` + factory; RBAC via `can()` +
`PermissionRoute` + registry metadata (exact-match entries required for any new
canonical tab — see 2.6.0 precedent); organization isolation via
`useOrganization` + mismatch guards; project/show scope via
`useProductionContext`; UX/theme unchanged (no visual redesign); deep links
preserved via `PreserveQueryRedirect`/`TabRedirect`.

---

## 1. API client — `src/api/client/ApiClient.ts` (KEEP)

- Public API: `apiClient` (typed request methods), `dispatchMockRequest` path in
  mock mode → `mocks/mockRouter`; errors via `api/errors/*`.
- Consumers (31): `core/repository/BaseRepository`, `core/testing` suites,
  module repositories, `core/api/index` re-export.
- Migration path: none (already canonical). T3-1 converges mock *dispatch*
  behind it; callers unchanged.
- Merge/remove: none in this phase.

## 2. Repository — `api/repositories/interfaces/` + `core/repository/BaseRepository` (MERGE into)

- Public API: `IRepository<T>` + domain interfaces; `RepositoryFactory`
  (`RepositoryBundle`: project/task/asset/shot/organization/auth/delivery/publishing);
  `BaseRepository` (search/filter/pagination, `AppError` mapping).
- Consumers: 21 (`core/repository`) + 23 (`api/repositories`) incl. all module
  repositories, `main.tsx`, parity harness.
- Migration path: delete the 6 duplicated `modules/*/repositories/I*.ts`
  (T1-1); module repositories import interfaces from `api/repositories`.
- Files to merge: 6 module interface copies → `api/repositories/interfaces/`.
  Files to remove: those 6 copies.

## 3. Mock adapter — `api/repositories/adapters/mock/*` + `BaseMockAdapter` (KEEP, extend)

- Public API: `Mock{Asset,Shot,Task,Organization,Project,Auth,Delivery,Publishing}Adapter`
  over `mocks/db` seeds; `searchableFields`, session persistence, DRF-shaped pagination.
- Consumers: factory (mock mode default), all module repositories in mock mode.
- Migration path: MSW `handlers/*` delegate to adapters instead of re-implementing
  endpoint logic (T3-1, per-domain). `mockRouter` retired per domain after parity.
- Merge/remove: `mocks/db/tasks/timelogs.ts` → `mocks/db/production/timelogs.ts` (T0-6).

## 4. REST adapter — `api/repositories/adapters/rest/*` (KEEP)

- Public API: `REST*Adapter` per domain, 1:1 with mock adapters via factory.
- Consumers: factory (rest mode). Migration: none; every mock-delegation change
  must keep rest path untouched and boot-verified in both modes.

## 5. Permissions — `usePermissionEvaluator` + catalog/roles (REPLACE into)

- Location: `core/permissions/usePermissionEvaluator.ts`, `permissionCatalog.ts`,
  `systemRoles.ts`. Public API: `can(permission)`.
- Consumers: 9 (widest). Migrate 5 `usePermissions` + 1 `usePermissionStore`
  call sites (T1-3); remove `usePermissions.tsx`, `usePermissionStore.ts`.
- `Can.tsx`/`HasRole`/`PermissionControl`/`FieldPermissionGate` stay (components, not evaluators).

## 6. Authorization — registry + guards (KEEP, extend-by-addition)

- Location: `core/permissions/routePermissionsRegistry.ts` (+ `PermissionRoute`,
  `RoutePermissionGuard`, `enterprisePermissions`, engines).
- Rule: new canonical tabs get **exact-match** registry entries (additive only —
  never loosen `:tab` fallbacks). Engines (bulk/resource/field/scope/workflow/
  external) are distinct responsibilities: KEEP.

## 7. Workspace — `shared/workspace` + `canonical/` (RENAME + REMOVE dead copy)

- Public API: `Workspace`, `WorkspaceShell`, `WorkspaceTabs`, `ContextBar/Stack`,
  `EntityDrawer/Ref`, `PeekPanel`, search modal; `canonical/` action bar/buttons/shell.
- Consumers: 20+ (assets/shots/production/org pages). Migration: REMOVE dead
  `canonical/WorkspaceHeader.tsx` (0 importers); RENAME survivor
  `WorkspaceHeader.tsx` → `WorkspaceToolbar.tsx` (different component, avoids confusion).

## 8. CRUD — `shared/crud` (pilot-gated REPLACE)

- Public API: `EntityList/EntityTable/EntityForm/EntityDetail`, dialogs/drawers,
  `fieldSchemas` (SHOT/TASK/PROJECT fields), `BulkActions`.
- Consumers today: only `DataPlatformPage`. Migration: pilot `TasksPage` onto
  `EntityTable`; adopt repo-wide on success, delete kit on failure. No broad rollout yet.

## 9. Bulk operations — `shared/components/bulk` (KEEP + SHARE hook)

- Public API: `BulkOperationEngine`, `BulkActionBar` (4 importers),
  `BulkUpdatePanel<T>`, `BulkImportGrid`, `BulkOperationPreview/Result`,
  `BulkValidationSummary`, `ExistingEntityResolver`, `SoftDeletedEntityRecovery`.
- Migration: REMOVE dead `core/permissions/components/BulkActionBar`; add generic
  `useBulkEntity(service, keys)` (only justified new abstraction — twins differ
  solely in entity names); keep thin per-entity wrappers.

## 10. Tables — `shared/crud/EntityTable` (pilot-gated, see §8)

- 15 hand-built tables stay until pilot proves parity (sorting, selection,
  pagination, empty/error states). Remove dead code only, not working tables.

## 11. Filters — `shared/filters` (pilot-gated SHARE)

- Public API: `FilterBuilder`, `QuickFilterBar`, `filterEvaluator`.
  1 consumer (`ProductionView`). Migration: pilot on one audit page; `TestingPage`
  inline filters migrate last (most complex).

## 12. Forms — `shared/crud` kit + shared primitives (SHARE kit, KEEP domain schemas)

- Canonical: `EntityForm<T>` + `fieldSchemas` + `shared/components/FormFieldError`
  + `components/system/ValidationSummary`. Domain schemas (`auth/schemas`,
  per-entity validation) stay local. Migration with §8 pilot.

## 13. Activity/audit — module + shared pair (KEEP both, divided)

- `modules/audit` (3 workspace shells + 8 pages + `useAudit*` services) owns fetch;
  `shared/activity/ActivityTimeline` + `shared/stores/useActivityStore` (17
  consumers) own display. No merge across the fetch/display line.

## 14. Error handling — `core/api` + `api/errors` (KEEP)

- Public API: `centralErrorHandler`, `ApiError/AppError/errorMapper`,
  `core/errors/ErrorBoundary`, `ApiErrorState` (6 importers), `ValidationSummary`.
  Migration: none. Fix deferred minor (pipeline double-toast) in implementation phase.

## 15. Notifications — `core/notifications/notify` + `useNotificationStore` (KEEP)

- `notify.{success,error,warning,info}` used repo-wide (TestingPage, PlatformAdmin,
  guards). Migration: none.

## 16. Entity context — `shared/relationships/entityRegistry` (canonical contract; core copy becomes façade)

- Decision: the shared copy is canonical — typed `ENTITY_CONFIGS`
  (routePrefix/idPrefix/icon/color per entity) on the CRUD type system, aligned
  with the canonized CRUD kit. The `core/workspace` copy (mock-backed universal
  resolver, 7 workspace-chrome consumers) becomes a delegating façade during
  migration, then is removed. Bridge `UniversalEntityType → EntityType`.
- Files to merge: resolver behavior into shared copy. Files to remove (end-state):
  `core/workspace/entityRegistry.ts` (after 7 consumers port + contract tests).

## 17. Organization context — `core/organization` (KEEP)

- Public API: `OrganizationProvider`, `useOrganization`, `OrganizationContext`
  (64 importers). Migration: none. Isolation guards stay verbatim.

## 18. Project/show context — `core/production` (KEEP, documented split)

- Public API: `ProductionContextProvider`, `useProductionContext`,
  `ProductionContextGuard` (34 consumers) for scope + `useProductionStore` for
  UI selection state. Migration: none; document context-vs-store split.

---

## Rollout order for implementation (Phase 4+)

T0 removals (7 files) → T1 merges (interfaces, evaluators, test helper, timelogs;
bulk-hook sharing) → renames → T2 pilots (TasksPage table, one audit filter) →
registry unification (contract-first) → mock convergence per-domain → splitting.
Per-step gates: `vitest run` + `tsc --noEmit` + `biome check src` (+ `vite build`
for moves), mock+rest boot checks for data steps, RBAC/org-isolation spot checks
for permission steps. Nothing in this document authorizes broad refactoring —
each step is separately approved at implementation time.
