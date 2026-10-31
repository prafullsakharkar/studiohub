# Phase 22: the last legacy production layer removed: verification

Branch `sync/phase-22-legacy-production-types` (from `develop` at `6b5efc5c`, which holds Phases 14 to 21), **not pushed, not merged**. No backend file was touched. `main` is untouched.

The owner said yes to all three questions of the proposal: one phase, deleting the workspace tabs screen is allowed, and Phase 21 is merged first (it was: `develop` = `6b5efc5c`, pushed).

## 1. What was there

| Legacy code | What it was | Evidence it had no use |
|---|---|---|
| `types/production.ts` (1,508 lines, 123 types, `[key: string]: any` on most) | hand-written shapes of the shot, asset, task, project, version, show, sequence … | 16 source files and 3 tests imported 25 names; 11 of them were the bulk screens' own state types (moved, with the 4 types they refer to), the rest had a typed twin in `api/production/*` or were unused. Swapping the three bulk managers, `bulkRoutes` and four other users to the typed `Shot`, `Asset`, `Task`, `Show`, `Version`, `Project` gave **0 compile errors**: the old types were looser, not richer |
| `useProjectScopedData` (284 lines) and the legacy `projectScopedApi` service class (205) | the old project-scoped hooks; the file held the last Biome **error** | reached only through an unused re-export (`PROJECT_SCOPED_QUERY_KEYS`); the screens use the typed `projectScopedApi` in `api/production/structure` |
| `core/production/ProductionContext.tsx` (198), `useVersions`, `VersionService` | a context that **made up a show** (`show-<project>-main`, empty name and code, status "In Progress") and synced its id into the store | the only consumer was `useVersions`, which nothing imported; `VersionService` existed for that hook. The version screens use `api/production/review` |
| The `/workspace` screen: `modules/workspace`, `shared/workspace` (11 files), `core/workspace` (3), `types/workspace` | an open-tabs workspace with split view, peek panel and entity search | its entity resolver `resolveEntity` was a stub that **returns `null`**, its search returned `[]`, nothing in the app linked to it (route and sidebar searched), so it could only show a not-found state. The Breadcrumbs lookup through the same stub always fell through |

## 2. What it is now

- The bulk screens' types are in `shared/components/bulk/types.ts` (moved verbatim); `ActiveTimerState` is in `useTimerStore`; `isEpisodicProject` is in `modules/production/projectWorkflow.ts`. The bulk managers use the typed entities. The wire format of the bulk routes is unchanged (Phase 20, verified live).
- `/workspace` redirects to `/dashboard` (like `/calendar` → `/scheduling`); its registry entry and the open `page.workspace` rule stay, so the redirect is not gated oddly.
- `AppLayout` no longer reads tabs; the active-project sync from the route is unchanged for `/shows/:id` and `/projects/:id`.
- **Session cleanup** (finding S-1 of Phase 13): the screen kept its tabs, with record names, in `localStorage` under `studiohub_workspace_state_v2`. A browser that used it still holds that copy, so `clearUserScopedState()` now removes the key directly instead of resetting the store.

## 3. Removed (no silent deletions)

Each group is its own commit, so it can be reverted alone.

| Commit | What | Lines |
|---|---|---|
| `41854c5a` | `useProjectScopedData.ts`, `api/projectScopedApi.ts`, the re-export | −490 |
| `113695b8` | `ProductionContext.tsx` (and its provider in `AppLayout`), `useVersions.ts`, `VersionService.ts`, their barrel exports; the bulk types move to their own file | +163 / −338 |
| `7de37901` | `types/production.ts`; `ActiveTimerState` and `isEpisodicProject` moved; typed entities in the bulk managers | +45 / −1,516 |
| `8a5d7056` | the `/workspace` screen with its store, persistence, resolver stub and types; the Breadcrumbs lookup; the AppLayout branch; the redirect; the CLAUDE.md lines about the store | +33 / −3,660 |

Net for the phase (frontend, against `develop`): 50 files, **+240 / −6,003**.

## 4. Gates

| Gate | After Phase 21 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 103 files / 1,038 | **103 files / 1,039** (+1: the `/workspace` redirect; the session-cleanup test now seeds the retired key instead of using the removed store) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 1 error / 1,066 warnings | **0 errors / 802 warnings** (the file with the last error is gone; no rule was changed) |
| Dead-file finder (`unreachable.mjs`) | tests, key lists and helpers only | the same set: **nothing newly unreachable** |
| Live vitest, fresh seed each | | `bulkRoutes.live` **3 of 3**, `auth.live` **18 of 18** |
| Playwright role smoke | 7 of 7 | **7 of 7** on the third run (6 of 7 on the first, §6) |

`tsc` excludes tests and `src/test`, so I searched them (and `e2e/`) for the removed modules: none refer to them. The unit suite and the live files above are what exercise them.

## 5. Mutation checks (break the code, expect a test to fail): 4 caught

Session cleanup no longer removes the retired tabs copy; session cleanup removes the wrong key; `/workspace` redirects to `/projects`; the `/workspace` route removed. The rest of the phase is deletion plus type moves, whose proof is the compiler (0 errors) and the unchanged suite, not a new behaviour.

## 6. Smoke

**7 of 7 pass** (21.3 minutes), on the third run. The history, in full:

1. **First full run: 6 of 7.** The production admin test failed: `/system-logs: expected to be refused, was shown`. The same user saw `/audit` and `/jobs` shown and `/platform/admin` refused, as expected; no 403, no server error, and a "Request Timeout" toast on the last page.
2. **That role alone, re-run: passed** (7.1 minutes against about 3 normally, so the machine was loaded); `/system-logs` was refused.
3. **Full run again: 7 of 7.**

I could not explain the first failure, and I want that on the record rather than called a flake. What I know: nothing under `core/permissions`, `e2e/`, the seed harness or `backend/` differs between this branch and the Phase 21 run that passed (`git diff` is empty); the route guard decides only from the user the server returns (`/auth/me`, no cached fallback); the page needs `masterdata.catalog.manage` (the `page.platform_admin` rule), which the seeded production-admin role does not hold. So the server must have returned a different permission set for that user in that one run, or the page was read before the redirect. The backend log of that run was overwritten by the next run, so I cannot say which. If it recurs, capture `backend.log` and the `/auth/me` response of that run before anything else.

## 7. Not done, and questions for the owner

- **`activeShowId` is still an invented id.** `ProjectWorkspacePage` sets it to `show-<project>-main` and `usePermissions` passes it into the scope context. A real show id never matches it, so it has no effect today, but it is a made-up value in the permission input. Removing it touches `useProductionStore`, the permission scope and a few route guards; I left it for a phase of its own.
- **`frontend/CLAUDE.md`** still describes `BaseRepository` and the module `repositories/` folders, which Phase 20 removed. Only the workspace-store lines were fixed here.
- Deferred, unchanged: scheduling week/day/timeline views, applying the chosen theme and locale, the delivery milestone picker, the leave-cancel endpoint, the checksum screen. `main` is behind `develop` by many phases and is untouched.

1. **Merge** `sync/phase-22-legacy-production-types` into `develop` and push?
2. **Next:** the three items above are the whole of what I know is left that is legacy. Do you want (a) the `activeShowId` clean-up, (b) a pass to correct `frontend/CLAUDE.md` and `docs/frontend`, or (c) a new area (say which)? I would do (a) and (b) together as a small Phase 23.
