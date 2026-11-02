# Phase 18: the shot and asset workspaces: verification

Branch `sync/phase-18-shot-asset-workspaces` (from `develop` at `b00ecc4e`, which holds Phases 14 to 17), **not pushed, not merged**. No backend file was touched. Opening a page directly without a chosen project was left as the owner decided (Q3: no); the typed pages no longer need the project context to load a record, which is a side effect, not a goal.

## 1. What was wrong

The routed `/shots/:id` and `/assets/:id` pages were the last legacy workspaces. Some of their tabs were already typed (tasks, linked assets, versions, reviews, media, history); the rest was not:

| Where | What it did | Evidence |
|---|---|---|
| Shot and asset **Notes** tabs | showed a hard-coded list of notes ("Editorial Department (AVID)", "2 days ago") | `ShotNotesTab`, `AssetNotesTab` literal arrays |
| Shot and asset **Assignments** tabs | showed a made-up staffing table ("Elena Rostova", "Kai Thorne"); the Assign dialog offered the same invented artists and wrote `assigned_artist_name` / `department`, which the serializer drops, so nothing saved | `ShotAssignModal`, `AssetAssignModal` |
| Asset **Dependencies**, **Publishing**, **Attachments** tabs, and the overview | hard-coded geometry caches, "Skeletal Rigging", "Sarah Jenkins" | the component files |
| Header defaults | a missing handle count showed 8, a missing department "Compositing", a missing priority "Medium", a missing version "v001" | `ShotWorkspacePage` |
| **Approve** | offered in every state; the server approves only from Pending Review (400 `invalid_transition` otherwise). On assets it was a status PATCH behind a permission (`asset.approve`) the permission map marks as having no backend | `_workspaces_flow.json` `shot_approve_from_not_started_400` |
| **Delete Shot Permanently** | there is no permanent delete: `DELETE` and the archive route are the same soft delete (the shot disappears from `GET` and appears in the archived list). The text said "permanently removed" | `shot_delete`, `shots_archived_after_delete` |
| **Assign** action | gated on `shot.assign` / `asset.assign`, which the permission map marks as unbacked (no backend), so by its rule nobody was shown it | `permissionMap.ts` |
| **Launch USD Viewport** | only showed a toast "Hydra Viewport Active" | |
| **Overflow menu (shared)** | `WorkspaceOverflowMenu` ignored an action's `confirm`: any action past the first three ran **without asking** (including the old "Delete Permanently") | `WorkspaceOverflowMenu.tsx`; fixed for every workspace |
| Tab badges | fetched the first 100 tasks and 100 versions of the whole system and matched them by code prefix or title text | `ShotWorkspacePage` |

## 2. What the pages are now

- **Shot:** Overview (the shot's own fields, its pipeline stages, approvals), Tasks, Assets, Versions, Reviews, **Notes**, Media & Files, History. Actions: Edit, Assign, Add Task, Submit New Version, Add Note, Approve (Pending Review only), Copy code, Copy frame range, **Archive** (confirms first, returns to the list).
- **Asset:** Overview (own fields, **parent and child assets**), Tasks, Shots, Versions, Reviews, **Notes**, Media & Files, History. Same actions, without Approve and the frame range; Copy USD prim path only when the asset has one.
- **Assign** picks a project member and saves `assigned_artist` (the user id; `null` unassigns). One shared dialog for both.
- **Notes** are the project's notes (`/projects/{id}/notes/`), searched by the record's code and kept only where the note's own `entity_type` and `entity_id` name this record (the route has no entity filter and searching by code also finds notes that merely mention it). A new note carries the link and a category.
- Add Task and Submit New Version open the forms with the record already chosen (checked against what the forms read from the URL).

## 3. Removed (no silent deletions), commits `734864e2` and `1aa5f6c2`

| What | Why |
|---|---|
| Shot: `ShotOverviewTab`, `ShotNotesTab`, `ShotAssignmentsTab`, `ShotAssignModal`, `ShotAddNoteModal` | invented content, or writes the API drops; replaced by the pieces above |
| Asset: `AssetOverviewTab`, `AssetNotesTab`, `AssetAssignmentsTab`, `AssetDependenciesTab`, `AssetPublishingTab`, `AssetAttachmentsTab`, `AssetHierarchyTree`, `AssetAssignModal`, `AssetAddNoteModal` | the same; the hierarchy is now the real parent and children, and files are the Media tab |
| Tabs: shot **Assignments** and **Activity** (the same history as History), asset **Assignments**, **Dependencies**, **Publishing**, **Attachments** | no data behind them |
| Actions: Approve on assets, Launch USD Viewport, Delete Permanently (shot and asset), Restore (an archived record cannot be opened; restoring is in the archived view of the list) | none exists on the server, or it only showed a toast |
| `modules/attachments` (4 files), `shared/components/attachments` (3), `shared/components/Input.tsx` | nothing imported them once the legacy tabs were gone |

## 4. Gates

| Gate | develop | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 98 files / 1,004 | **101 files / 1,023** (+19: 8 shots, 8 assets, 3 action bar) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 1 error / 1301 warnings | **1 error (the same) / 1194 warnings** |
| Playwright role smoke (6 roles + phone width) | 7 of 7 | **7 of 7 pass** (20.5 minutes) |
| Live vitest, fresh seed | | `entityWorkspaces.live` (2 tests) **pass**: assign and unassign, a linked note found again by its code, Approve from Pending Review (the API reports Approved), Archive (the record then answers 404 and appears in the archived list), the child asset on the parent's page |
| Frontend diff vs develop | | 34 files, +974 / −5,363 |

Mutation checks, 17 distinct mutations, all caught: the overflow menu ignoring confirm; Approve offered in every state; Archive through DELETE; assign writing a name or an empty string; notes not narrowed to the record, not searched by code, or not naming the record; children not matched by parent id or searched across every project; the parent never loaded; Archive asking nothing; Add Task or Submit New Version naming the wrong kind of record. Two were missed at first (the children's project filter and the asset's Add Task link) because nothing asserted them; the assertions were added and the mutations re-run.

Real responses: `samples/production/_workspaces_flow.json` (captured by `docs/sync/tools/test_capture_workspaces.py`).

## 5. Findings for the owner, and what was not done

- **Backend, low:** `PATCH /shots/{id}/ {"assigned_artist": <a user who is not a member of the project>}` answers **200** (`shot_assign_non_member_400` in the capture, named for what I expected). Task assignment refuses a non-member (400 "Unknown user."). The screens offer members only, so nobody is hurt today. If you want the shot and asset rule to match the task rule, that is a small change request (CR-34); I have not written or made it.
- **Not done:** the bulk managers (`ShotBulkManager` 811 lines, `AssetBulkManager` 374, `TaskBulkManager` 399, `ShotBulkAdd`) and the legacy hooks, services and repositories they use (`useShots`, `useAssets`, `ShotService`, `AssetService`, `TaskService`, `api/repositories`). A rough scan found no reads of fields the API lacks in them (only local state names), and they call real bulk routes, so they were left; moving them to the typed API is a refactor, not a fix.
- `api/client/upload.ts` is no longer imported by anything except its own test (it already was unreferenced from the app before this phase; the attachments uploader was its last user). Removing it and its test is a one-line follow-up.
- An asset has no "Approve": the server has no such action; its status changes in the Edit form like any other field.

## 6. Questions for the owner

1. **Merge** `sync/phase-18-shot-asset-workspaces` into `develop`?
2. Write **CR-34** (a shot's or asset's artist must be a project member, like a task's assignee)?
3. Next: the bulk managers and legacy services (refactor, no known defect), or one of the smaller deferred items?
