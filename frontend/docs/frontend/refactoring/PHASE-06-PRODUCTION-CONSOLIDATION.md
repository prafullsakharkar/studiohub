# Phase 06 — Production Consolidation (implemented 2026-09-23)

Scope: Projects, Shows, Sequences, Shots, Assets, Tasks, Versions, Reviews,
Deliveries, Editorial, Scheduling, Resources (= `ProjectResourcesTab`),
Pipeline (= `ProjectPipelineTab`), Publishing, Media, Playlists, Workflows.
Rule: zero production-behavior change — verified by 377/377 tests, tsc,
Biome, build, and scoping spot-checks. Deep links, CRUD, bulk, search/filter,
RBAC, activity, audit, mock/REST all preserved.

## 1. Executed: activity-recording consolidation (commit `0b988ed`)

- 12 files / 30 call sites migrated from `activityService.recordActivity`
  (writes record but bypasses zustand sync → entries missing from live
  `ActivityTimeline`) to `useActivityStore.recordActivity` (delegates to the
  same service method, then syncs store state). Same record created (dedup
  cache + scoping preserved inside the service); timelines now show entries
  that were previously silent. Pure fix-forward, no API change.
- Files: asset/shot/task/sequence/project/org mutation hooks, 4 note/version
  modals, `AuthProvider`, `trackEntityMutation` (via `getState()` — plain fn).

## 2. Assessed, deliberately NOT merged (evidence inside)

- **Mutation hooks** (Asset 126 / Shot 173 / Task 70 / Version 135+ lines):
  structurally divergent — toggle-archive vs dedicated archive/restore methods,
  shot-only approve op, delete-with-activity vs delete-silent asymmetry,
  differing invalidation sets. A generic needs op-toggles + strategy switches:
  a new abstraction for 2 consumers. Deferred until op sets align.
- **Workspace shells** (Asset/Shot ~900-line pages): same skeleton
  (`params.tab || ?tab || 'overview'`, ScrollableTabs, action menus) but
  entity-specific headers/menus/tabs; extraction risks deep links. Deferred.
- **Tab content** (Overview/Activity/Notes/Media/Reviews × entities): same tab
  names, different data + UI — AssetActivityTab is static narrative, Shot's is
  live query. Merging changes content. Deferred.
- **Modals & bulk managers**: same skeleton, domain columns/categories/validation.
  Shared bulk *kit* already used; manager roots stay per-entity. Deferred.
- **Project embedded tabs** (`ProjectShotsTab` 1241 / `ProjectAssetsTab` 1195):
  reuse domain hooks + bulk managers (composition, not duplication). KEEP.

## 3. Scoping audit: Org → Project → Show → Entity holds

- Hooks (`useShots/useVersions/useAssets`/…) scope queryKeys by
  `organizationId/projectId/showId` from `useProductionContext` with strict
  `enabled` guards; `PROJECT_SCOPED_QUERY_KEYS` factory enforces the hierarchy.
- `ProjectRoute` gates org access (→ `/unauthorized`) + project membership
  (→ `NoProjectAccessPage`); `ReviewsPage` uses inline `can('review.create')`.
- **Hardening gap (untouched, follow-up)**: `ProjectWorkspacePage:30` falls back
  to hardcoded `'org-apex-01'` and resolves via unscoped `globalProjectsData`
  fallback — safe today only because `ProjectRoute` gates first (unlike
  `AccessWorkspacePage`'s in-page deny). Mirror the deny pattern when the page
  is next touched. No active leak (route gates verified).

## 4. Verification

- `vitest run` 377/377 · `tsc --noEmit` 0 · `biome check src` 0 · `vite build` ok.
- Routes untouched; no mock/REST contract changes; RBAC calls unchanged
  (only the activity sink moved, behind the identical input type).

## Files merged / removed

- Merged: activity-recording call sites (12 files, −42/+53, no deletions —
  `activityService` remains the engine, store the façade).
- Removed: none in Phase 06 (all removal candidates failed the
  behavior-preservation bar on evidence; see §2).
- Next candidates when behavior work is approved: mutation-op alignment,
  shell extraction with redirect-proof tab mapping, timelog type unification.
