# Phase 21: the project workspace on the typed API: verification

Branch `sync/phase-21-project-workspace` (from `develop` at `1cba997d`, which holds Phases 14 to 20), **not pushed, not merged**. No backend file was touched. `main` is untouched.

## 1. What was wrong

The 24 project tabs are thin wrappers over typed modules and were already correct. The legacy weight was in the shell, `ProjectWorkspace.tsx`, and in a hand-written `Project` type that the API does not have. I captured what the running backend does for each project action (`docs/sync/tools/test_capture_workspaces.py`, `samples/production/_workspaces_flow.json`) and compared it to what the page offered.

| The page offered | What the backend does (captured) | Result |
|---|---|---|
| **Close / Reopen**: `PATCH {status: 'Completed'}` | `400 "Completed" is not a valid choice.` The statuses are In Progress, Pending Review, Approved, On Hold, Archived | the button could never work: removed. Status changes through the Edit form |
| **Archive**: `PATCH {status: 'Archived'}` | `200`, but the project stays live, is not in `/projects/archived/` and can still be opened | it reported success and archived nothing: now the real archive |
| **Delete**, in a dialog saying "permanently delete … cannot be undone" | `DELETE` is the same soft delete as the archive route: the project is listed in `/projects/archived/` and can be restored | the dialog was false: Delete removed, one honest Archive action |
| **Restore** on an archived project | an archived project answers `404` when opened, so its workspace cannot be shown | removed; restoring is done from the archived list |
| **Clone**: created a project from the whole object (including `approved_shots`, `created_at`) | `201`; the server ignores every field it does not own, so the copy looked complete but only the settings were ever copied | **Duplicate**: sends the settings only, says so in the dialog, and opens the new project |
| **Attachments** tab | no project attachment route exists | the tab held an in-memory list with a made-up uploader ("Alex Chen"), a fixed file size and `#download` links: removed |
| Header image `banner_url` / `logo_url` | neither field is in the API | `thumbnail_url` only |

## 2. What it is now

- `ProjectWorkspace` takes the typed `Project` (`@/api/production/structure`) and calls `projectsApi` directly: `create` for Duplicate, `archive` (the soft delete) for Archive. After either, the project queries and the audit history are refreshed.
- Actions, each gated by its backend code (`useCan`): **Edit** (`project.update`), **Duplicate** (`project.create`), **Export** (the manifest as JSON; unchanged), **Archive** (`project.archive`, after a confirmation that says it can be restored from the archived view; then back to `/projects`).
- `useProject` / `useProjects` use the typed routes (`projects/{id}/`, `projects/?page_size=100`); the `project.view` gate (S-3) is kept. The twelve tabs, the switcher and `isEpisodicProject` use the typed `Project` (the function now takes the few fields it reads, so a typed project and a legacy one both fit).

## 3. Removed (no silent deletions)

Each group is its own commit, so it can be reverted alone.

| Commit | What | Why |
|---|---|---|
| `a5f56dba` (inside the workspace rewrite) | the Close/Reopen, Delete and Restore actions; the Delete dialog; `banner_url` / `logo_url` | §1 |
| `dc963142` | `project-tabs/ProjectAttachmentsTab.tsx` (237 lines), `hooks/useProjectMutations.ts` (56), `services/ProjectService.ts` (37); 330 lines | the tab was invented data (§1); the hook and the service were used only by the workspace, which now calls `projectsApi` |

Net for the phase (frontend): 23 files, +342 / −517.

## 4. Gates

| Gate | After Phase 20 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 102 files / 1,030 | **103 files / 1,038** (+1 file, +8 tests: five workspace tests, three contract tests; the dead mocks in `ProjectWorkflowType.test.tsx` were cut, not the test) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 1 error / 1,083 warnings | **1 error (the same `useHookAtTopLevel`) / 1,066 warnings** |
| Live vitest (fresh seed) | 7 of 7 smoke | `projectWorkspace.live.test.tsx` **2 of 2 pass**: see §5 |
| Playwright role smoke | 7 of 7 | **7 of 7** (20.3 minutes) |

## 5. Tests, and what each was shown to catch

Unit (`modules/production/__tests__/projectWorkspace.test.tsx`, built on the captured `project_detail`, `project_clone_settings`): the page reads the typed routes with `page_size`; the tab list has no Attachments; only the supported actions are offered (no Close, Reopen, Delete or Restore, as a button or as a menu item); Archive asks first, then sends the soft delete to the project's route and returns to the list; Duplicate sends exactly the captured request's keys, with the typed name and code, and opens the new project. Contract (`workspaceContracts.test.ts`): the three behaviours in §1 pinned to the captured responses (status choices, the PATCH "Archived" that does not archive, archive → 404 → archived list → restore, DELETE as the same soft delete, the settings-only duplicate).

Live (`src/test/live/projectWorkspace.live.test.tsx`, a real backend, the manager signed in with MFA): a source project with its own fps, resolution, aspect ratio and colour space and one shot is duplicated through the page; the copy exists with the same settings and **no shots**, and the page shows it. A second project is archived through the page: not archived before the confirmation, afterwards it answers 404, is absent from the list and present in the archived list, and `restore` brings it back.

Mutation checks (break the code, expect a test to fail), **10 caught**: no navigation after Archive; Archive without the confirm; an extra field in the duplicate request; no navigation after Duplicate; Archive calling `restore`; no `page_size`; a Delete action offered (as a button or as a menu item); an Attachments tab put back; and, live, the duplicate that drops `fps`. Two of them first **passed** and exposed weak tests that I fixed: the absent-actions check looked only at menu items, and a third visible action is a button; the Attachments check looked for a rendered tab, but only the active section's tabs render, so it now reads the section list. One control mutation (an inert extra property on an action) was not caught, as it should not be.

## 6. Smoke

Run on this branch (`docs/sync/tools/run_role_smoke.sh`, six roles and the phone-width pass): **7 of 7 pass** (20.3 minutes). A first launch collided with a second one (two backends on one seed) and reported "No tests found"; the interrupted run had left its seeded users in the test database, which a small transactional backend test flushed, and the smoke was run once, alone.

## 7. Questions for the owner

1. **Merge** `sync/phase-21-project-workspace` into `develop`? Frontend, tests and `docs/sync` only. (`main` is behind `develop` by many phases; I have not touched it and will not unless you ask.)
2. **Project status "Completed"**: the old page tried to close a project with it and the server refuses it. If studios need a "finished" state the project would need a new status choice, which is a backend request. I did not write one; say so if you want it.
3. **Restoring an archived project** is possible only from the archived list (`/projects/archived/`). If you want it reachable from a workspace, the workspace would have to open archived records, which the server answers 404 today.
