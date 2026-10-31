# Phase 13 — Cross-cutting hardening: verification

Branch `sync/phase-13-hardening` (from `develop` after the CR-26 to CR-31 merge, `514ed3cb`), **not pushed, not merged**. No backend file was touched. `main` was updated earlier at the owner's request (`a3e4161c`) and is untouched by this phase.

## 1. Exit criteria

The plan names five things: E2E smoke per role, a consistency pass, performance, security, accessibility and responsive checks, and the final README. I set the test for each.

| Criterion | Result | Evidence |
|---|---|---|
| Each seeded role opens every route in a real browser against the factory-seeded backend, with no server error, no uncaught exception, no dropped session, and no refused request on a page that was shown | ✅ | `frontend/e2e/live/roles.smoke.spec.ts`: platform administrator (MFA), production admin, supervisor, lead artist, artist, a user with no role; 60 routes each; **7 of 7 pass** (36 minutes) |
| The expected routes are shown and refused for each role | ✅ | a per-role matrix in the spec (settings, access, logs, publishing bulk, audit, jobs, automations, the whole production area for the no-role user) |
| Phone width: no sideways scroll, no unnamed field or button, a heading on every page | ✅ | the same file, one test at 375 px; a control page proves the probe reports each fault, so a clean result means something |
| Performance: pages load on first use | ✅ | initial JavaScript **629 KB → 341 KB** gzipped (main chunk 1,626 KB → 814 KB raw, 77 chunks); the charts library is no longer fetched at start |
| Security audit | ✅ with 3 fixes | §3 |
| Consistency: dead code | ✅ | 59 files and 7 test files removed, §4; the legacy code that is still in use is listed in §6 |
| Final `docs/sync/README.md` | ✅ | index, state, how to check, habits, deferrals |

## 2. Quality gates

| Gate | Phase 12 / after CR-26 to 31 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 99 files / 964 | **96 files / 959** (+11 tests: four new files and two tests added to existing ones; −16 tests in the 7 files removed with the dead code, §4) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 2106 warnings | **2 errors (the same two) / 1853 warnings** (the removed files held most of the warnings) |
| Live vitest files (fresh seed each) | 15 files / 82, all pass | not re-run: no backend or API code changed in this phase |
| Playwright role smoke | n/a (new) | **7 of 7 pass** (36 minutes) |
| Net size (frontend) | | 86 files in `frontend/src`: +388 / −11,079 against `develop` |

Mutation checks (break the code, expect the test to fail): the `project.view` gate on the project list (unit and e2e), the session cleanup (the sign-out site, the stored workspace copy, the favourites), the lazy-route guard (two files; commit `78219d8b`), the safe-link guard (the media list, the entity media tab, the helper). A batch of four checks was first mislabelled by my own script (I passed it a command that reversed the exit code) and was redone; one mutation (`clearStorage()` on the production store) was **not** caught because the line was redundant, so I removed the line.

## 3. Security audit

| Check | Result |
|---|---|
| HTML sinks (`dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`) | none in `src` |
| Links that open a new tab | all carry `rel` with `noopener` |
| Secrets in the built bundle | none: the `.env` values were searched for in `dist/` (only the public `VITE_API_URL` is there, as designed); no key patterns |
| Tokens in logs | the only token-related log line is "Access token refreshed" (no value); no `console.log` outside the logger |
| Token storage | access token in memory; refresh token in `localStorage` with a cross-tab lease (owner's decision Q6, recorded in CR-11) |
| **Finding S-1 (fixed):** a signed-out browser kept the previous person's open workspace tabs (record names) and chosen, recent and favourite projects in `localStorage` | `clearUserScopedState()` now runs on every way a session ends (sign-out, rejected refresh, account disabled, another tab signing out); `ad6bbad8` |
| **Finding S-2 (fixed):** media preview/source URLs and a software's website became `href` values as stored; the API only stores http(s)/ftp, but a `javascript:` or `data:` value written another way would run on click | `safeWebUrl` keeps only http(s); `44b41b0f`. The software link has the helper but no render test |
| **Finding S-3 (fixed):** the project switcher asked for `/projects/` on every page; a signed-in user with no role drew a 403 each time (found by the role smoke) | `useProjects` waits for `project.view`; `be5206a2`. The e2e test fails with the gate removed |

Not covered: HTTP security headers and CSP (set where the app is served, not in this repository's frontend code), dependency vulnerability scanning, and a penetration test.

## 4. Removed (no silent deletions)

Each group is its own commit, so it can be reverted alone. The finder is `docs/sync/tools/unreachable.mjs`: a file nothing reachable from `main.tsx` imports, statically or with a literal `import()`. Tests are not roots, so a file only a test imported counts as unreachable, and those tests went with it. Documentation outside this folder that mentions them is historical (plans and reports) and was left alone, except two rows of the canonical-components table.

| Commit | What | Why |
|---|---|---|
| `9435f243` | `shared/crud` (12), `shared/views` (10), `shared/filters` (3), `shared/relationships` (7), four `shared/hooks`, `shared/layouts/PageLayout`, `shared/stores/usePermissionStore`, `shared/components/FormFieldError` and `PermissionsSimulatorModal`; 40 files, 7,201 lines; and the 7 tests that only exercised them (BulkDelete, EntityTable, usePersistedViewMode, useTransientFeedback, simulatorBoundary, SavedViewsBar, GridView.pagination; 281 lines) | the generic CRUD, saved-view, filter-builder and relationship-picker layer was replaced by `DirectoryListPage` / `DirectoryFormPage` and the typed API modules in Phases 3 to 12; nothing imports it. The simulator-store boundary test guarded only the removed store |
| `e793698e` | `core/permissions`: `Can`, `HasRole`, `FieldPermissionGate`, `SensitiveField`, `WorkflowStateTransitionControl`, the field and workflow-state engines, `enterprisePermissions`, `systemRoles`, two barrels; 11 files, 2,952 lines | authorization is `useCan` / `evaluateAccess` over backend codes; nothing imports these |
| `156aee56` | `modules/episodes` (hooks, repository, service, barrel); 6 files, 362 lines | no route and no importer |
| `5de0dea1` | `components/ui/Menu`, `components/system/ValidationSummary`, and their two rows in `CANONICAL_COMPONENTS.md`; 2 files, 201 lines | no importer, no test |

## 5. Findings from the role smoke, and what they were not

- The first runs reported different "shown" routes for the no-role user each time. That was my test reading the URL while the route guard's "Checking route permissions" spinner was still up, not a permission bug; the spec now waits for the spinner and the lazy-load "Loading…" to clear. The one real finding it led to is S-3.
- A first version used client-side navigation to go faster; it reported every route as shown because `pushState` changes the URL itself. It was replaced by real page loads (it ran in 35 to 48 seconds per role but proved nothing; real loads take about 3 minutes per role).
- `/platform/admin` once appeared as "shown" to the artist. With the spinner handled it is refused for every role but the platform administrator, as the registry says.
- A client "Request Timeout" toast appeared once on a phone-width run; the next runs recorded no API call slower than 5 seconds, so it was load on the throwaway server, not a slow endpoint.
- The live backend harness stops after 20 minutes by default and a run left half-finished by an interrupted command kept its seeded users in the test database. Both are handled: `SYNC_LIVE_MINUTES`, and the runner script stops the backend it starts.

## 6. Deferred / not done (with evidence)

- **Legacy data access still in use.** `modules/{clients,vendors,departments,offices,teams}` hooks and `core/masterData/useMasterData.ts` still call the old `api/masterDataApi.ts` (7 importers), and `BaseRepository` still backs two repositories (`SequenceRepository`, `EditorialTrackRepository`; 6 files with their interfaces). Replacing them means rewriting those workspace pages onto `resourceApi`; I did not do it in a hardening phase.
- **Client-side activity feed.** `useActivityStore` (an in-memory log that the shot, asset, task and project mutations write to, shown by `ActivityTimeline` and the command palette) is not the server's audit history and is lost on reload. The real history component is `EntityHistory`. Replacing it touches about ten files.
- **Accessibility beyond names and headings:** colour contrast, keyboard order and focus traps, chart text alternatives. No accessibility engine was added: `axe-core` would be a new dependency and I did not find a reason that the checks above could not carry for now.
- Frontend CI: the repository has none (`CLAUDE.md`); the role smoke and the unit gates run by hand or with the commands in `docs/sync/README.md`.
- The software link's helper has no render test (the page needs a heavy fixture).

## 7. Questions for the owner

1. **Merge this phase** into `develop` (and later `main`)? It changes only the frontend, tests, and `docs/sync`.
2. **Remove the legacy data access and the client-side activity feed (§6) in a follow-up?** I would do the activity feed first (it shows data the server does not have) and the five directory workspaces after.
3. **Q-22** is still open: say so if the studio wants "the active theme" and I will write the request with the new field.
4. **CR-05** (broken dev seed commands) is no longer needed by the browser tests, which use the factory harness; the request stays open only for people who want a seeded development backend.
