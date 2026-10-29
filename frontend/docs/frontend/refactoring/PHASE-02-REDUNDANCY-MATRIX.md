# Phase 02 — Redundancy Matrix (analysis only, nothing deleted)

Source: `docs/frontend/refactoring/PHASE-01-ARCHITECTURE-INVENTORY.md` (2026-09-23).
Method: every verdict below was re-verified by import, route, registry, and
content diff — deltas quoted where mechanical. Verdicts use:
KEEP · MERGE · REPLACE · MOVE · REDIRECT · REMOVE · SHARE · RENAME.
Priority tiers: **T0** safe removals → **T1** mechanical merges →
**T2** behavior-sharing refactors (tests first) → **T3** architectural (phased).

Rule honored: extend the existing canonical implementation; no new abstraction
where one exists. Candidates proposing a *new* shared thing are marked as such
and justified.

---

## T0 — Safe removals (0 importers, verified) — REMOVE

| # | Candidate | Evidence | Verdict | Files removed |
|---|-----------|----------|---------|---------------|
| T0-1 | `src/components/permissions/PermissionMatrix.tsx` (838 lines) | 0 importers since 2.6.0 deleted its only consumers; twin at OrgStructure is a different (smaller) component, not a replacement target | REMOVE (after confirming no dynamic import; grep clean) | 1 |
| T0-2 | `src/components/entity/entityConfig.ts` | 0 importers; registries live in `core/workspace` + `shared/relationships` | REMOVE | 1 |
| T0-3 | `src/core/permissions/components/BulkActionBar.tsx` | 0 importers; live copy is `shared/components/bulk/BulkActionBar.tsx` (4 importers) | REMOVE | 1 |
| T0-4 | `src/shared/workspace/canonical/WorkspaceHeader.tsx` | **CORRECTED 2026-09-23: LIVE** — `CanonicalWorkspaceHeader` is imported from the `@/shared/workspace/canonical` barrel by `AssetWorkspacePage` + `ShotWorkspacePage` (earlier 0-count missed barrel imports) | KEEP | 0 |
| T0-5 | `src/components/ui/Dialog.tsx`, `Menu.tsx` | **CORRECTED 2026-09-23: LIVE** — imported by `EntityRbacIsolation.test.tsx` / `OrganizationAuditRbac.test.tsx`, which deliberately test Dialog a11y semantics + Menu permission gating (earlier scan wrongly excluded test dirs) | KEEP | 0 |
| T0-6 | `src/mocks/db/tasks/timelogs.ts` (208, `Timelog`) vs `src/mocks/db/production/timelogs.ts` (108, `TimelogEntry`) | **CORRECTED 2026-09-23: DIFFERENT TYPES** — task-level vs production-level timelogs; merge needs type unification (T2-level decision), not a T0 delete | DEFER | 0 |

**T0 total executed 2026-09-23: 3 files removed** (`components/permissions/PermissionMatrix`, `components/entity/entityConfig`, `core/permissions/components/BulkActionBar` + barrel line) **+ 2 renames** (`OrgStructure/PermissionMatrix` → `RoleDetailPanel`, `shared/workspace/WorkspaceHeader` → `WorkspaceToolbar`). Suite 371/371, tsc/biome/build green.

## T0b — Rename-only (no removal, kills confusion)

| # | Candidate | Verdict |
|---|-----------|---------|
| T0-7 | `platform/.../OrgStructure/PermissionMatrix.tsx` (163, props `{role, permissionsByCategory, onEdit, onDuplicate}`) is a role-detail panel, not a matrix | RENAME → `RoleDetailPanel.tsx` |
| T0-8 | `shared/workspace/WorkspaceHeader.tsx` (store toolbar, used by `Workspace.tsx`) vs `canonical/WorkspaceHeader.tsx` (breadcrumb header, unused — removed in T0-4) | RENAME survivor to `WorkspaceToolbar.tsx` after T0-4 |

## T1 — Mechanical merges (identical structure, diff-verified)

| # | Candidate | Evidence | Verdict | Files removed |
|---|-----------|----------|---------|---------------|
| T1-1 | `I*Repository` ×6 duplicated (`api/repositories/interfaces/` ↔ `modules/*/repositories/`) | Same basenames (Asset/Auth/Organization/Project/Shot/Task); module copies implement the api ones | MERGE → keep `api/repositories/interfaces` as the single home; module files re-export or are deleted | 6 |
| T1-2 | `useBulkAssets.ts` ≡ `useBulkTasks.ts` (both 148 lines; diff is only entity/service/types/query-keys) | 132 diff lines, 100% mechanical | SHARE → new generic `useBulkEntity(service, keys)` in `shared/` (justified: no generic bulk hook exists); keep thin per-entity wrappers for route stability | 0 removed, −~250 duplicated lines; `useBulkShots` (271) follows |
| T1-3 | Permission evaluators ×3: `usePermissionEvaluator` (9 consumers) vs `usePermissions`+`PermissionGate`/`HasPermission` (5) vs `usePermissionStore` (1 + internal) | Overlapping `can()` surface | REPLACE → `usePermissionEvaluator` everywhere (6 call sites); REMOVE the other two modules | 2 |
| T1-4 | Org test-tree helpers: `src/__tests__/test-utils.tsx` vs `features/…/helpers/testUtils.tsx` (both define `createTestQueryClient` + org providers) | Same helpers, dual maintenance across 35 test files | SHARE → one helper home (`src/test/`); migrate imports | 1 |

**T1 total: ~9 files + ~250 duplicated lines.**

## T2 — Behavior-sharing refactors (prove with pilot + tests first)

| # | Candidate | Before → After | Verdict |
|---|-----------|----------------|---------|
| T2-1 | Tables ×15 hand-built; `shared/crud/EntityTable` 0 importers | Pilot `TasksPage` on `EntityTable` → adopt repo-wide or delete kit | REPLACE (pilot-gated) |
| T2-2 | Filters hand-rolled per page (`TestingPage` 5 dimensions inline, audit pages) vs `shared/filters` (1 consumer) | Pilot `QuickFilterBar` on one audit page → adopt | SHARE (pilot-gated) |
| T2-3 | `entityRegistry` fork: `core/workspace` (1127 lines: mock-data-backed universal resolver/search) vs `shared/relationships` (883: typed config + relation graph) — same names (`resolveEntity`, search), different type systems | Contract-test both consumer sets (7 workspace-chrome + 4 CRUD), then unify behind versioned API | SHARE (contract-first) |
| T2-4 | Master-data config UIs: org `MasterDataTab/*` (477+403+228 lines) vs platform `Platform*Tab` (679+436) — same catalogs, different scope | Extract scope-prop components shared by both | SHARE |
| T2-5 | Org test trees: `features/…/__tests__` (live, real pages) vs `src/__tests__/organizations` (parallel, incl. dup `OrganizationsPage.test`) | Migrate unique cases → live tree, delete dup file + retired tree | MERGE |
| T2-6 | Services (17 files, 30–96 lines, pure pass-through + singleton) | KEEP the seam (explicit, cheap, stable) — revisit only if a service grows logic | KEEP |

## T3 — Architectural (phased, mock+rest verified each step)

| # | Candidate | Before → After | Verdict |
|---|-----------|----------------|---------|
| T3-1 | Endpoint logic ×3: MSW `handlers/*` (inline auth/scope/filter/pagination) vs `adapters/mock/*` (BaseMockAdapter) vs `mockRouter` (6.7k lines, 25 domains) — MSW opt-in (`VITE_USE_MSW`), default path is adapters | Handlers delegate to adapters; retire `mockRouter` per domain; factories→db rule; `test/mocks/factories` for unit-only builders | SHARE-then-REMOVE (per-domain, mock-mode suite each step) |
| T3-2 | `modules/` vs `features/` duality (dashboard wrapper+full; org tests-only tree) | Document ownership: `features/` = cross-cutting surfaces, `modules/` = domain verticals; keep `DashboardPage` wrapper | MOVE (decision, not code) |
| T3-3 | `core/api` index re-exports `api/*` (errors, ApiClient) — two import spellings for one thing | One import path per symbol (barrel in `api/`, `core/api` keeps error-handler/generated only) | MOVE |
| T3-4 | No route-level `lazy()` (5 MB bundle incl. test engine + mocks) | Split routes; mocks/test-engine out of default chunk | SHARE (build architecture) |

## Explicit KEEP verdicts (analyzed, do not touch)

- `TestingPage` vs `ApiHealthPage` — different users/data/lifecycles (reaffirmed).
- `SmartImg` (63 importers; `MediaThumbnail` builds on it) vs `Media*` kit — layered, keep.
- `shared/Modal` (104) — canonical; dead `Dialog/Menu` wrappers removed instead.
- RBAC engines (bulk/resource/field/scope/workflow/external) + `mockAuthGuard` (request-level, mock-side) — distinct responsibilities.
- `ApiClient` (TestingPage/parity/refresh) vs repository adapters — distinct call paths; converge dispatch in T3-1, not by deletion.
- Per-entity workspaces/pages/hooks — compose the shared kit; duplication is local markup, addressed via T2-1/T2-2 pilots.
- Schemas/types (`dashboardSchema`, `authSchemas`, generated contract, per-domain `types/`) — distinct, no duplication found.
- `DataPlatformPage` + `shared/crud` kit relationship — kit's only consumer; pilot in T2-1 decides its fate.

---

## Before / after proposal

- Before: 879 files; 6 duplicated interfaces; 3 evaluators; 2 test trees (35 files);
  3 mock behavior paths; 15 ad-hoc tables; per-page filters; 7 dead files.
- After (T0+T1+T2-5 done): ~860 files; 1 interface home; 1 evaluator; 1 org test
  tree; tables/filters converging on shared kit (or kit removed if pilot fails);
  mock paths converging per-domain (T3-1); bundle split (T3-4).

## Estimated safe removals

| Tier | Files removable | Risk |
|------|----------------|------|
| T0 (+T0b renames) | **7** | ≈ zero |
| T1 | **9** (+ ~250 lines via T1-2 sharing) | low, mechanical |
| T2-5 (test merge) | **~5–8** (retired tree + dup file) | medium, suite-gated |
| T3-1 (mock retire) | **1+** (`mockRouter` per-domain; counted when retired) | high, phased |
| **Total confident** | **~21–24 files** | |
| Aspirational (kit adoption decides) | `shared/crud` partial, `Dialog/Menu` already in T0 | pilot-gated |

## Do-not-implement note

No code was changed in this phase. Phase 3 implementation order: T0 → T1 →
T2 pilots → T3 phases, each step green on `vitest run` + `tsc --noEmit` +
`biome check src` (+ `vite build` for moves), mock+rest boot checks for data
steps, RBAC/org-isolation spot checks for permission steps.
