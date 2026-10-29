# Phase 6 — Production B: shots, assets, tasks, time: verification

Branch `sync/phase-6-production-work` (from the Phase 5 tip `017525fb`, which is **not merged into `develop` yet**; `git log 017525fb..HEAD` lists the commits, 12 before this report), **not pushed**. No backend file changed. Open backend requests: **CR-13** (kept for later by the user), **CR-14** (new, proposed), questions Q-16 and Q-17.

## 1. Exit criteria

Exit: *artist and lead flows (pick task → log time → lead approves) work with role-correct UI.*

| Criterion | Result | Evidence |
|---|---|---|
| Artist moves a task along, logs time on it | ✅ live | `work.live` › the artist is offered exactly the moves the server accepts (no Approved), PATCHes the status, logs 2.5 h from the real dialog; the log is born Submitted and counts as *awaiting approval*, not logged |
| Lead sees the artist's log and approves it | ✅ live | the lead's Time logs page lists it with Approve/Reject; approving makes it final (no Approve, no Edit afterwards) and moves the task's `logged_hours` from `0.00` to `2.50` |
| Rejection and resubmission | ✅ live | reject asks for a reason first (refused in the browser if empty), the artist sees the reason on the row, resubmits, the lead approves; status history reads `Submitted>Rejected, Rejected>Submitted, Submitted>Approved` with the reason |
| Nobody approves their own time | ✅ live | the lead is not offered Approve on their own log, and the server answers 403 when asked anyway |
| Shot approval is a lead's action | ✅ live | the artist gets no status control and 403 on `approve`; the lead is offered Approved only on the shot that is in Pending Review, and it goes through `POST …/approve/` |
| Role-correct controls | ✅ unit | create/edit/archive/approve controls follow `task.create`, `task.update`, `shot.update/approve`, `asset.create/delete`, `timelog.approve/view_all`; 26 tests build the roles from the captured artist user plus the seeded lead permissions |
| Scope: shots, assets, tasks, timelogs, templates, project tabs | ✅ with gaps | §3 and §6 |

Live files, each on a fresh seed: `work` 5, `production` 6, `departments` 10, `masterdata` 6, `audit` 6, `identityAdmin` 4, `auth` 18, `restricted` 4 = **59 passing**.

## 2. Quality gates

| Gate | Phase 5 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 75 files / 538 | **78 files / 592** |
| Live tests | 7 files | **8 files / 59 tests** |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 3353 warnings | **2 errors (the same two) / 2906 warnings**; the 59 files changed in this phase have 0 errors |
| Clean `git worktree` (symlinked `node_modules`) | typecheck 0, 538/538 | **typecheck 0, 592/592** |
| Net size (frontend) | | 95 files, +3,481 / −15,332 |

Mutation checks (break the code, expect a failure): own-log approval, positive-hours rule, bulk-status body key, task link key, Approved sent as PATCH, the `shot.approve` gate, the task link filter, the unlink URL, episodic detection, sequence upper-casing, withholding the sequence list, the status table, and a removed/invented interface field (the last one found a real hole, §5.1).

## 3. What was built

| Area | Where |
|---|---|
| Capture | `docs/sync/tools/test_capture_production_work.py` → `samples/production/_work_flow.json` (230 calls: shots, assets, tasks, timelogs, templates; every filter probed alone; artist, lead, other artist, stranger) |
| Typed API | `api/production/work.ts` (`shotsApi`, `assetsApi`, `tasksApi`, `timelogsApi`, `taskTemplatesApi`), `statusFlow.ts` (the backend's transition tables, tested against what the server accepted and refused), `*RowKeys.ts` (row types pinned to the capture) |
| Lists and forms | `modules/production/work/{shots,assets,tasks,timelogs,templates}.tsx` on the directory pattern; inline `StatusMenu` offering only valid moves; `LogTimeDialog`; pickers for projects, sequences, episodes, shots, assets, tasks, task/asset types and project members (assignees must be members) |
| Directory pattern, extended | bulk selection and actions, a separate create and delete permission, per-row edit/delete rules, reason and date prompts on row actions, conditionally visible fields, initial values, positive numbers, `rowKey`, pre-fill from the query string, scoped lists (`scope`, `createQuery`, `headerExtra`) |
| Workspaces | task page (facts, time, status history, changes); shot and asset workspaces keep their Phase 7 tabs (versions, reviews, media, notes, publishing…) and swap tasks, linked assets, usage and history for panels on the real API; edit and add-task open the new forms |
| Project tabs | shots, assets, tasks and time logs are the scoped lists; bulk add keeps its episodic wiring in `ShotBulkAdd` |
| Templates | list, form with an items editor, apply to a shot or asset (reports created vs already existing), copy a studio template into a project |
| Stopwatch | the banner's "stop and save" now logs through `LogTimeDialog` |
| Tests | `workContracts` 31, `work` 13, `shotsAssets` 11, `templates` 2, `ShotBulkAdd` 3, `work.live` 5 |

## 4. Removed (no silent deletions)

Whole files, chosen by an import-graph walk from `main.tsx` compared with the Phase 5 tip (commit `58c216b6`, 7,631 lines; page trimming in `dff9be25`):

| What | Why |
|---|---|
| Bodies of `TasksPage`, `TaskDetailPage`, `TimelogsPage`, `ShotsPage`, `AssetsPage` (replaced in place) | hand-written against the legacy hooks; replaced by the lists and workspace above |
| Task **Board, Calendar, Timeline and Table views**, `TaskBulkOperationsBar`, `TaskCreateModal` (1,108 lines), `TimelogCreateModal` | replaced by the list, forms and bulk actions. **The Board, Calendar and Timeline views are not rebuilt (§6, Q-17)** |
| Task workspace tabs Overview, Details, Assignment, Dependencies, Schedule, Timelogs, Activity | replaced by the task page; **editing a task's `dependencies` and `schedule` JSON has no screen now (§6)** |
| `useTimelogs`, `TimelogService`, `TimelogRepository`, `ITimelogRepository` | only the removed time screens used them |
| Asset `AssetCreateModal`, `AssetEditModal`, `AssetGalleryView`, `AssetTasksTab`, `AssetUsageTab`, `AssetActivityTab`, `AssetHistoryTab`, `AssetCreateTaskModal`; shot `ShotEditModal`, `ShotCreateTaskModal`, `ShotTasksTab`, `ShotActivityTab`, `ShotHistoryTab` | replaced by the forms and panels. **The asset gallery view is not rebuilt** |
| `BulkActionBar`, `BulkUpdatePanel` (shared), `useInspectorStore` | only the removed lists used them. **The "bulk update" grid for shots and assets has no screen; `bulkUpdate` is typed** |
| Tests `ShotBulkWiring` (adapted into `ShotBulkAdd.test`, same three behaviours) and `ShotCreateEpisodic` | the second tested the removed create dialog; on the new form the server's "episode required" message lands on the `episode_id` field |
| `'proj-001'` / `'NK99'` fallbacks | the legacy lists opened bulk add on a made-up project when none was chosen |
| Orphaned but **left**: `core/permissions/{HasRole,workflowStateEngine,components/WorkflowStateTransitionControl}`, `shared/hooks/usePersistedPagination` | each sits behind a barrel export or other dead code; the client-side workflow engine is superseded by the server's status machine |

## 5. Findings (details in `backend-change-requests.md`, "Phase 6 notes")

1. **My own error, found and fixed:** `tsconfig.json` excludes every test file, so the `Record<keyof T, true>` lists I described in the Phase 4 and 5 reports as "fails to compile" never failed `tsc`; only the list-versus-capture comparison ran. The lists now live in `*RowKeys.ts` modules that `tsc` compiles, verified by removing and by inventing an interface field. Both earlier reports carry the correction.
2. **My own error:** the Phase 4 report said plain masterdata edits write no `AuditLog` rows. A real server writes one line per write (the rows are written on commit, which a rolled-back test transaction never reaches). The Phase 4 live test only passed because it asserted before the events query returned; it is fixed and the claim corrected.
3. **CR-14 (bug, proposed):** an ordinary timelog accepts negative hours; only an adjustment may. The form never sends one.
4. **Writes silently drop unknown keys.** A task created with `shot_id` is stored as a *General* task, 201, no link. The link is `entity_type` + `entity_id`; `shot_id`/`asset_id`/`sequence_id` are read-only and list filters.
5. **Write responses are not read-shaped**, and **timelog hours are numbers on reads and strings on writes**: the client re-reads after saving and normalises with `Number()`.
6. **Status rules (from `workflow.py`, confirmed live):** shots and tasks move freely among the working states; Approved is entered from Pending Review only; a bad move is 400 `invalid_transition`. **Assets have no transition table and no status-history route.** A code can be changed by PATCH until a version exists, then `rename-code`.
7. **Filters that do nothing, silently:** shots `assigned_artist`; assets `code`; tasks `code`, `reviewer`, `show_id` (the method returns the queryset unchanged). Every filter the screens use was probed alone.
8. **Latent bugs in code I touched:** `ConfirmDialog` replaced every plain `Error` with generic text, so Phase 3's "Choose a new end date" never reached the user (now `InputError` + `serverMessage`); a refused status move showed "The submitted data is invalid" instead of the server's sentence; `isEpisodicProject` compared `workflow_type` with `'Episodic'` (the backend sends `'episodic'`) and only worked because `type` also said "Episodic Series"; the shot bulk grid offered "Ready for Review", which the backend rejects; a disabled `EntityPicker` listed everything while waiting for its parent field; an empty-items template row showed a red border but no message.
9. **Harness:** a live file's first manager sign-in is a TOTP replay if it starts within the seeding step, and the 10 s hook timeout then fails it (`departments.live` did). The runner now waits for the next step. Not a product bug.

## 6. Deferred / not done

- **Task Board, Calendar and Timeline views; asset gallery view** (Q-17). The data is the same list; a status Board is a grouping of it.
- **Time log adjustments** (a negative correction of an approved entry) have no screen; `adjustment_of` is typed. **Time log status history** is typed and has no screen (task and shot history are shown).
- **Editing a task's `dependencies` and `schedule`** JSON, and the "bulk update" grid for shots and assets.
- **`timelog.manage`** (logging time for someone else) has no picker in the time form.
- Shot and asset workspaces still render their Phase 7 tabs (versions, reviews, media, notes, publishing, attachments, assignments) through the legacy components; Phase 7 replaces them. The shot and asset overview tabs are legacy too.
- Bulk grids still carry columns the backend ignores (shots have no `priority`/`department`).
- `useActivityStore` and its remaining callers (versions, reviews, playlists): Phase 7.
- Open: Q-02, Q-04, Q-07, Q-09..Q-17, CR-13 (kept for later), CR-14.

## 7. Questions for the owner

- **Q-16** An `artist` can update **any** task of the project (`task.update` is in the seeded artist role), including changing assignee and status, not only their own. Intended?
- **Q-17** Rebuild the task **Board** (kanban by status) now, or leave the list as the only task view until Phase 10 (scheduling owns calendars)?
- **CR-14** Approve the one-line server check, so a script cannot post negative hours either?

## 8. Follow-up on branch `sync/phase-6b-task-board` (after the owner's "do it as per suggestion")

Phases 5 and 6 were pushed and merged into `develop` (`6189dfd0`, `477fc943`, pushed); `main` untouched. Then, on a new branch from `develop`:

| Item | Result |
|---|---|
| **Task Board** (Q-17) | `?view=board` on Tasks and a Board/List switch on the project's Tasks tab: a column per status, drag and drop or the card's menu, only to columns the backend allows, filters by project / mine / search, a notice when it shows only the first 500. 6 unit tests (3 mutation-checked) and a live test (a real drag changes the server's status; a refused column is not even tried). Calendar and Timeline views stay with Phase 10; the asset gallery is not rebuilt |
| **CR-13 applied (`archive` only)** | `POST archive/` on projects and shows needs `project.delete` / `show.delete` (backend commit `d539d6e1`). **My proposal was wrong about `check-existence`:** mapping it makes those viewsets answer **500** (`_existence_items_from_request` was never implemented there). It stays unmapped (403) and is pinned by a test. The frontend keeps `DELETE`, which now has the same effect |
| **CR-14 applied** | an ordinary timelog needs hours > 0 on create and update (omitted hours too); an adjustment may be negative, never zero. `TestOrdinaryHours` (6 cases); live: -1 and 0 answer 400, a negative correction of an approved entry is accepted |
| Backend verification | 32 new/changed tests, mutation-checked (remove the map entry, either hours check: each fails); **555 related production tests pass** (targeted; the full backend suite was not run); `ruff check` clean; `manage.py check` shows only the existing MFA warning; the new type error is none (one existing `create.py:34` error is not on a line I touched) |
| Samples re-captured | `_structure_flow.json` (archive 200, existence checks 403) and `_work_flow.json` (negative hours 400); the contract tests and the Phase 5 live test that pinned the old behaviour were updated |
| Q-16 | left as is, per the suggestion |
| Gates | typecheck 0; unit 79 files / 598 tests; live `work` 7, `production` 6 (others unchanged); build OK |
