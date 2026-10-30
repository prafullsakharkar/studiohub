# Phase 7 — Production C: versions, reviews, playlists, media, workflows: verification

Branch `sync/phase-7-production-review` (from `develop` after the Phase 6 / Board merge), **not pushed, not merged**. No backend file changed. Open backend requests added: **CR-15**, **CR-16** (extended), questions **Q-18**, **Q-19**.

## 1. Exit criteria

Exit: *version → review → approve round trip; playlist built and shared.*

| Criterion | Result | Evidence |
|---|---|---|
| Version → review → approve round trip | ✅ live | `review.live` › an artist makes a version; a lead moves it to Pending Review and starts a review; a vfx-supervisor decides it; the lead then approves, publishes and makes it the hero. A lead is never offered the decisions (`review.approve`), and whoever submitted a review cannot approve it (403 `separation_of_duties`, its sentence is shown) |
| Participants, comments, Retake | ✅ live | `review.live` › a participant gives their own verdict, comments thread one level and resolve, and Retake goes through `verdict` |
| Playlist built | ✅ live | `playlists.live` › a lead creates a playlist, adds a version, a placeholder and a second version from the workspace, moves one up, removes the placeholder; the API order is checked after every step |
| Playlist shared | ✅ live, with a caveat | the lead records the sharing flags and the server stores them. **The server only records them** (Q-19): there is no link, passcode check or expiry, and the dialog says so |
| Role-correct UI | ✅ unit + live | an artist reads playlists, versions and reviews and gets no controls (`playlists.test`, `review.test`, `playlists.live`) |
| Scope: media, workflows, automations, project tabs | ✅ with gaps | §3 and §6 |

Live files, each on a fresh seed: `review` 3, `playlists` 1, `work` 7, `production` 6, `masterdata` 6, `departments` 10, `audit` 6, `identityAdmin` 4 = **43 passing**. `auth` (18) and `restricted` (4) use none of the changed code and were not re-run. The directory pages were changed (json field, `onlyOnCreate`, unlinked first column), which is why `work`, `production`, `masterdata`, `departments`, `audit` and `identityAdmin` were re-run.

## 2. Quality gates

| Gate | Phase 6 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 78 files / 592 | **86 files / 682** |
| Live tests | 8 files / 59 | **10 files / 65** (the playlist file is new; `work` gained the Board tests; 8 files re-run now, §1) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 2906 warnings | **2 errors (the same two) / 2362 warnings**; the files changed here have 0 errors |
| Clean `git worktree` (symlinked `node_modules`) | typecheck 0, 592/592 | **typecheck 0, 682/682** |
| Net size (frontend) | | 127 files, +18,095 / −19,270 (against `develop`) |

Mutation checks (break the code, expect a failure): lead approving, the status table, reorder order, placeholder body, the activate/deactivate swap, JSON validation, trigger merge on edit, `onlyOnCreate`, the project scope of a tab, the entity filter of the versions tab and the media type check. The one mutation not caught (sending `entity_id` on the reviews tab) changes only a request parameter the server ignores.

## 3. What was built

- **Typed API** (`src/api/production/review.ts`, `reviewRowKeys.ts`): versions (publish, unpublish, promote, add-to-playlist, status history), reviews with their parts (versions, participants, comments, notes, annotations, activity), playlists (entries, reorder, share), media, workflows (activate, deactivate, clone, simulate), automation rules and logs; every response key list is a compiled, exhaustive assertion.
- **Versions** (`/versions`, `/versions/new`, `/versions/:id/edit`, `/versions/:versionId`): list with status menu limited to valid moves, publish/unpublish/make hero behind confirmations, frozen once published, workspace with status history, add to playlist, reviews of the version and "Start a review".
- **Reviews** (`/reviews…`): list, form, and a workspace whose action bar offers exactly the moves the status allows and the caller may make (Submit, Start review, Approve, Request changes, Reject, Retake, Close); participants with their own verdict, threaded comments with resolve/reopen, notes, annotations, activity.
- **Playlists** (`/playlists…`): list, form, workspace with ordered entries (reorder, add version, add placeholder, remove) and a share dialog.
- **Media** (`/media…`): list, form (links, not files).
- **Workflows** (`/workflows…`): list with activate/deactivate/clone, form with JSON `nodes` and `transitions`, workspace showing the stored graph and a labelled dry run.
- **Automation rules** (`/automations…`): list and form (trigger as an object, conditions and actions as JSON).
- **Project tabs** for versions, reviews, playlists, media and workflow: scoped lists.
- **Shot and asset workspace tabs** for versions, reviews and media: this entity's records, with "New …" links pre-filled.
- **Shared form extension** (`modules/directory`): a `json` field kind (validated, sent parsed), `onlyOnCreate` fields, and `rowLink: () => null` for a list with no detail page.
- **Error text**: `serverMessage` now shows a refusal's own `detail` (separation of duties, frozen versions) instead of the generic 403 sentence.

## 4. Removed (no silent deletions)

All unreachable from `main.tsx` and imported by no test; typecheck clean after each batch. Separate commit `2f78700a` (71 files, −15,438 lines):

| Area | Files | Why |
|---|---|---|
| `modules/reviews` | 21: review workspace and its 7 tabs, header, three modals, the playlist workspace and its 3 modals, `useReviews`, `useReviewMutations`, repository and service | replaced by `production/review/ReviewWorkspace`, `PlaylistWorkspace` and the typed API |
| `modules/workflows` | 14: workflow studio, canvas (6 files), simulator, automation builder and audit-log modals, create modal, hook, repository, service | replaced by the list/form/workspace; the visual canvas is **not** rebuilt (§6) |
| `modules/versions` | 10: overview, notes, activity, publishing, reviews, media, playlists tabs, compare and edit modals, `useVersionMutations` | replaced by `VersionWorkspace` and the form |
| `modules/playlists`, `modules/media` | 5 + 3: hooks, repositories, services | replaced by the typed API |
| `modules/assets`, `modules/shots` | 4 + 4: the versions, reviews and media tabs and the submit-version modals | replaced by `EntityRecords`; "Submit New Version" opens the pre-filled form |
| `shared/components/media` | 5: grid, viewer, compare, metadata, thumbnail | only the removed review/version media tabs used them |
| `modules/production` | 1: `usePublishedVersions` | no caller left |

Also replaced in place (not deleted files): the five project tabs (1,348 lines → 5 small wrappers), `WorkflowsPage`, and the version/review/playlist/media tabs in the shot and asset workspace pages. One label changed: the asset action "Publish OpenUSD Version" is now "Submit New Version", because it created a version, it did not publish one.

Left alone on purpose: `core/permissions/Can.tsx` (shared, still exported by the barrel), and `useVersions`/`VersionService` (the shot and asset overview tabs still use them).

## 5. Findings (details in `backend-change-requests.md`)

1. **CR-15** — `archive` on media and reviews is unmapped (403 for everyone); the screens use `DELETE`, so archiving media needs `media.delete` (supervisor and above).
2. **CR-16** — missing validation: any review status on create, empty comments, free-text verdicts (`Banana` is stored; on a review it sets `supervisor_verdict` without moving the status), free-text `media_type`, non-unique workflow codes (a second clone repeats `<code>-COPY`).
3. **Q-18** — automation rules are never fired (`execution_count` stays 0), and workflow `simulate` reports every node a success. The screens say what is stored, not what runs.
4. **Q-19** — playlist sharing is a record only. The dialog is worded "Mark as …", sends three booleans and has no expiry field.
5. The server ignores `entity_id`, `shot_id`, `asset_id` on versions and reviews, and every entity filter on media, so entity tabs read the narrower list in full and filter.
6. **My own errors this phase**: I assumed reply/resolve acted on the comment (they answer the whole review); the first reply component crashed because nested replies have no `replies` key; the first `serverMessage` hid a 403's own sentence; tests called list-config hooks while building routes. Each was found by a test or a live run and fixed with a regression test. The live playlist test also failed once on a race of my own (it clicked "Remove entry 3" as soon as the API showed the new order, before the page did, so it removed a version); it now waits for the page.

## 6. Deferred / not done

- **Visual workflow canvas.** Nodes and transitions are edited as JSON. A drag-and-drop builder is a large piece of UI for a graph nothing executes (Q-18); it is not rebuilt.
- **Review media viewer** (frame-accurate compare, annotation drawing). Annotations are listed and can be added as data; there is no player, because media is a set of links (not files) in this backend.
- **Public playlist page / client approval** (Q-19).
- **Shot and asset overview tabs** still build their version lists from the first 100 versions by code prefix (`useVersions({ page_size: 100 })`); they are inconsistent with the new Versions tab for a project with many versions.
- Phase 6 deferrals stand: time-log adjustments, task dependencies and schedule editing, bulk-update grids, Calendar/Timeline views, asset gallery.

## 7. Questions for the owner

1. **Q-18**: is an automation engine planned? Until then the rules screen is configuration only.
2. **Q-19**: is a public review page planned? If so, what are the token, passcode and expiry contracts?
3. **CR-15 / CR-16**: approve, defer or drop? They are small; none blocks a screen.
4. Should a lead be able to archive media (`media.update`) as with playlists, or stay supervisor-only?
