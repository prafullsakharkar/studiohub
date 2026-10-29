# Phase 04 — Infrastructure Consolidation (implemented 2026-09-23)

Implements Phase 03 canonical decisions for shared infrastructure, in this order:
repository interfaces → bulk hook → table pilot. Per-area verification after each
unit: consumers migrated first, then `tsc --noEmit`, full `vitest run`, Biome,
import/route audit, obsolete-file removal. No route, permission, mock-endpoint,
or visual-theme changes in this phase.

## 1. Repository patterns — MERGED into `api/` (commit `34dc29c`)

- Base: `IBaseRepository` is now a type alias of `IRepository` (single definition;
  `BaseRepository` class satisfies it — tsc-verified). The api copies of
  `IAsset/IShot/ITaskRepository` use the same `Omit<…, 'bulkCreate'|'bulkUpdate'>`
  workaround the module copies used (tsc caught the conflict mid-merge).
- Deleted 5 dead repository classes (`Asset/Auth/Project/Shot/TaskRepository` —
  singletons were already aliased to centralized barrel instances; classes
  unreferenced) + 6 duplicated domain interfaces.
- Services repointed to `@/api/repositories` barrel (types + singletons).
  `OrganizationRepository` (live class over `organizationApi`) kept, now
  implements the api interface (structural compatibility tsc-verified).
- **Files removed: 11.** Behavior: type-level only; runtime untouched.

## 2. Bulk operations — SHARED generic hook (commit `46276d0`)

- New `src/shared/hooks/useBulkEntity.ts` (TDD: RED→GREEN, 3 tests) parameterizing
  service/keys/labels/titles/invalidation sets; `useBulkAssets/Tasks/Shots` are
  now thin wrappers (behavior byte-identical: titles, messages, tags, activity
  entries, per-op invalidations incl. shots' SEQUENCE keys).
- Twist found mid-work: React 19 + TanStack v5 never flips `isPending` true within
  sync `act()` in this repo's setup (proven by isolated probe) — the pending-flag
  test was replaced with a contract test; passthrough mirrors the production twins.
- Net −198 lines. Full suite green.

## 3. Tables — `EntityTable` controlled mode FIXED + pilot (commit `b4d42a9`)

- Fixed 3 latent controlled-mode bugs (missing server-search input, local-state
  pagination, local row-count override) with contract tests (3 tests).
- `ApiRequestsPage` table migrated: metrics, toolbar pills, detail/create modals
  untouched; table + pagination via kit (`sortable: false` preserves no-sort UX).
  One intentional normalization: pagination footer hides for single-page results
  (kit standard; old footer always rendered).
- Filters: `QuickFilterBar` pilot **deferred** — the kit bundles an advanced-filter
  trigger requiring a live `FilterBuilder` wiring; adopting it piecemeal would add
  dead buttons. Unblock: decouple search/pills from the advanced trigger first.
- Forms: pilot **deferred** — `fieldSchemas` covers 3 entities and `EntityForm`'s
  only consumer is `DataPlatformPage`; rewriting a production form (e.g. shot/task
  create) is a T2 workstream, not a safe pilot. Kit stays canonical target.

## 4. Verdict corrections (analysis was wrong; evidence won)

- T1-3 evaluators: `usePermissions`/`usePermissionStore` are the **role-simulation
  system** (setRole/isSimulating/customOverrides), not duplicate evaluators —
  migrating `CommandPalette.hasPermission`/`BulkActionBar.canPerform` would break
  simulation. **KEEP all three**, boundary documented.
- T1-4 test helpers: real-provider vs mocked-context strategies — unification
  belongs to the T2-5 test-tree merge, not standalone. **Deferred.**

## 5. Verification (final tree)

- `vitest run`: **377/377** (371 base + 3 bulk + 3 table). `tsc --noEmit`: 0.
  `biome check src`: 0. `vite build`: ok.
- Imports: zero references to deleted module repository/interface paths.
- Routes: untouched (no matches in phase diff). Mock/REST: no endpoint, handler,
  adapter, or contract changes — parity unaffected. RBAC/org isolation: untouched.

## Files merged / removed in Phase 04

Removed (14): 5 dead repository classes + 6 duplicated interfaces +
`IBaseRepository` body (now alias) counts as merged-in-place; net new files: 3
(`useBulkEntity`, 2 test files). `useBulk{Assets,Tasks,Shots}` rewritten as
wrappers (kept paths/exports). Total phase diff: +544/−1036.
