# Review pipeline: plan

Decisions: [DECISIONS.md](DECISIONS.md). Contracts: [CONTRACTS.md](CONTRACTS.md). Findings: [ANALYSIS.md](ANALYSIS.md).

The rules of the earlier programmes apply to every phase:
- one branch per phase, `feature/rp-N-<name>`, off `develop`;
- a contract entry for every API change, before the code;
- tests on the pytest test database (never the development database), targeted runs only, unless asked;
- mutation checks on the tests that matter;
- a frontend follow-up served from captured responses (`docs/sync/samples/`);
- a verification report, `docs/review-pipeline/rp-N-verification.md`;
- a stop after each phase. Commit, merge and push only when asked.

## RP-1 Data model cleanup

**Status:** WP 1.1 to 1.6 built on `feature/rp-1-data-cleanup` ([rp-1-verification.md](rp-1-verification.md)). The owner chose (2026-11-12) to write the drop before the audit output came in. Running `STAGING_AUDIT.sql` became a deploy step, run before migration 0004 (`docs/07-deployment/pre-deploy-checklist.md`).

**Goal.** Records are the only truth for what a version is in and what is said about it, so later phases (notes, roll-up, notifications) are built on them and not on copies.

### Why

1. A version answers six JSON lists: `reviews`, `playlists`, `notes_list`, `media_items`, `attachments` and `activity`.
   - These are caches, not truth (production DECISIONS D-18). The reviews and playlists they describe have been records since D-30 and D-31 (`ReviewItem`, `PlaylistEntry`).
   - No code writes five of them. The sixth, `playlists`, is appended to by `POST /versions/{id}/add-to-playlist/` (`backend/apps/production/api/viewsets/version.py:158`), even when the add names no playlist id. It never loses an entry when the version leaves a playlist.
   - The frontend reads none of them (`frontend/src/api/production/review.ts:12`).
2. The frontend cannot ask "which reviews or playlists hold this version". It reads every review of the entity, or every playlist of the project, and filters on the client (`VersionWorkspace.tsx:42`, `VersionExtras.tsx:19`). With more than 100 reviews on an entity, it misses some.
3. A review comment or annotation does not say which version it is on (`backend/apps/production/models/review_parts.py`). In a review of several versions, a note on frame 1012 has no picture. ShotGrid and ftrack link every note to the version.

### Work packages

| WP | What | Where |
|---|---|---|
| 1.1 | **The six cache keys leave every version response** (C-RP-01). `publishing_info` stays: it is written by `publish`. The model columns stay until WP 1.6. | `api/serializers/version/base.py`; the OpenAPI schema |
| 1.2 | **`add-to-playlist` stops writing `Version.playlists`.** The `PlaylistEntry` row is the only record (C-RP-02). | `api/viewsets/version.py` |
| 1.3 | **`version_id` filter on reviews and playlists** (C-RP-03, C-RP-04). It matches through the live `ReviewItem` and `PlaylistEntry` rows, keeps every other filter and the caller's narrowing, and never raises a 400 (the `project_id` alias style). Playlists get a `PlaylistFilterSet` in place of `filterset_fields`, keeping `status`, `project` and `client_only`. | `api/filtersets/review.py`, new `api/filtersets/playlist.py`, `api/viewsets/playlist.py` |
| 1.4 | **A version on comments and annotations** (C-RP-05, C-RP-06). A nullable `version` FK (`SET_NULL`) on `ReviewComment` and `ReviewAnnotation`, with a migration (no data step; old rows stay on the whole review). The `comments` and `annotations` actions accept an optional `version_id`. It must be a version of that review (a live `ReviewItem`), or the answer is 400. A reply takes its thread's version; a different one is 400. Every comment and annotation shape gains `version_id`. | `models/review_parts.py`, migration, `api/serializers/actions.py`, `services/review.py`, `api/serializers/review/parts.py` |
| 1.5 | **Frontend follow-up.** Drop the six keys from `Version` and `VERSION_KEYS`. Read reviews and playlists of a version with `version_id`, and remove the client-side filters. The review viewer sends the version on screen with every comment and annotation, and the panels show which version each one is on (or "Whole review"). Captures refreshed from the test database. | `frontend/src/api/production/review.ts`, `reviewRowKeys.ts`, `VersionWorkspace.tsx`, `VersionExtras.tsx`, `ReviewViewer.tsx`, `ReviewPanels.tsx` |
| 1.6 | **Contract step: drop the six columns.** This is a separate commit at the end of the phase, and only after the owner has run the read-only query in `STAGING_AUDIT.sql` on staging and production and seen what the columns hold. The values are caches (D-18), so a drop loses no truth. Anything that looks hand-entered is reported first. | `models/version.py`, a migration, `docs/review-pipeline/STAGING_AUDIT.sql` |

### Not in RP-1

- Attachments on a version (CR-52, proposed in frontend phase 32) stay as proposed. When CR-52 is approved, attachments are records, not the old `attachments` key.
- The version's activity: the frontend already reads the audit trail for the "Changes" and "Status history" tabs, so nothing replaces the `activity` key.
- Project notes on a version (`ProjectNote` with `entity_type` Version) are RP-2.
- `Playlist.share_settings` is unchanged (Q-RP-8 = B).

### Tests (targeted, test database)

- The version list, detail, create, update, publish, unpublish, promote and add-to-playlist answers have none of the six keys, and still have `publishing_info`.
- `add-to-playlist` leaves `Version.playlists` as it was, by id and by name.
- `version_id` on reviews and on playlists:
  - it matches only through live rows (a removed item or entry no longer matches);
  - an unknown or malformed value gives an empty list, not a 400;
  - it combines with `project_id` and `status`;
  - it does not widen what a partial member sees (a show-bound member asking for a version of another show gets nothing).
- Comments and annotations:
  - `version_id` of a version in the review is stored and returned;
  - one of a version not in the review is 400, and so is an item that was removed;
  - a version of another project is 400;
  - a reply takes its thread's version;
  - a reply naming another version is 400;
  - leaving it out keeps the old behaviour (`version_id: null`);
  - the review detail returns `version_id` on every comment, reply and annotation.
- The OpenAPI schema changes only in the places listed in C-RP-01 to C-RP-06.

Mutation checks: break each rule above (filter through deleted rows; skip the review-membership check; let a reply keep its own version; write the playlists JSON again; put a key back) and expect a failing test.

### Gates

- Backend from `backend/`:
  - `uv run ruff check .`;
  - `uv run python manage.py check`;
  - `uv run python manage.py makemigrations --check --dry-run`;
  - targeted `uv run pytest apps/production`;
  - basedpyright: no new errors in the changed files.
- Frontend from `frontend/`:
  - `pnpm typecheck && pnpm test && pnpm build`;
  - `pnpm exec biome check src` (0 errors);
  - the unreachable check.
- A browser role smoke of the review viewer (comment on a version in a two-version review), against a seeded backend on the test database.

### Release notes (draft)

- *Upgrading:* one migration (two nullable columns). WP 1.6 adds a second migration that drops six JSON columns from `production_version`; run `STAGING_AUDIT.sql` first. Deploy the frontend with the backend: an older frontend still works, because it reads none of the removed keys and sends no `version_id`.
- *API:* the version responses lose six keys nobody read. Reviews and playlists can be filtered by `version_id`. Comments and annotations name their version.

## RP-2 Notes: replies, links, a task

**Status:** approved 2026-11-12, every recommendation taken (Q-RP-11 to Q-RP-14 = A, [DECISIONS.md](DECISIONS.md#rp-2-answers)). Backend (WP 2.1 to 2.6) and frontend (WP 2.7) built on `feature/rp-2-notes` ([rp-2-verification.md](rp-2-verification.md)). Two points of this plan turned out differently; see the corrections below.

**Goal.** A project note works like a ShotGrid note: people reply to it in a thread, it names every record it is about (not just one), it can name the task that should act on it, and it can be addressed, closed and reopened. Review comments stay their own records (Q-RP-4 = B).

### Why (what is there today)

1. **No replies.** `ProjectNote` has no parent (`backend/apps/production/models/project_note.py:33`). `ReviewComment` has one, so threads exist only inside a review.
2. **One record per note, and the client writes it.** `entity_type`, `entity_id`, `entity_code` and `entity_name` are free strings (`project_note.py:45-48`). `ProjectNoteCreateSerializer` accepts all four as sent (`api/serializers/project_note.py`), and nothing checks that the record exists, is in this project, or is visible to the writer. The code and name shown to others are whatever the client typed.
3. **No way to ask for the notes of a record.** The route lists the whole project and only searches (`api/views/project_scoped.py:549`). The shot and asset Notes tabs search by code and filter on the client (`frontend/src/modules/production/work/EntityNotes.tsx:88`), so a note whose text names another shot's code is fetched and dropped, and a code change hides older notes.
4. **List and create only.** No detail, edit, status change or delete route. `status`, `addressed_by` and `addressed_at` exist, but only `status` can be set, and only on create (a client can create a note already "Closed"). The only permission is `note.create` (`constants/permissions.py:146`).
5. **No task.** Nothing says who should act on a note, which RP-6 (notifications) needs.

### Work packages

| WP | What | Where |
|---|---|---|
| 2.1 | **Model.** On `ProjectNote`: `parent` (self FK, `PROTECT`, null; replies only one level deep, like `ReviewComment`) and `task` (FK to `Task`, `SET_NULL`, null). A new `ProjectNoteLink` (note FK `CASCADE`, `entity_type` from a fixed list, `entity_id` UUID, unique per note and record, soft delete like the note). One migration with no data step, and a second, data-only one (WP 2.6). | `models/project_note.py`, migrations 0005 and 0006 |
| 2.2 | **Validated links and task on create** (C-RP-07). `links` (up to 20) and `task_id` are accepted; the old `entity_type` + `entity_id` pair still works and becomes the first link. Each record must be live, in this project and visible to the writer under the same narrowing as its own list route; otherwise **400**, one message for "not there" and "not yours", so no existence oracle. `entity_code` and `entity_name` are written by the server from the record; what the client sends is ignored. A new note always starts `Open`. | `api/serializers/project_note.py`, new `validators/project_note.py`, `services/project_scoped.py` (`ProjectNoteService`) |
| 2.3 | **Shape** (C-RP-08). Every note gains `parent_id`, `links[]` (type, id, code, name), `task_id`, `task_code` and `reply_count`. The first link stays mirrored in the four `entity_*` keys. | `api/serializers/project_note.py` |
| 2.4 | **Routes** (C-RP-09 to C-RP-13): the list shows threads only (no replies) and gains filters; detail with replies; reply; edit; status; delete. The rules on who may do what are Q-RP-11 to Q-RP-13. | `api/views/project_scoped.py`, `api/urls_project_scoped.py`, `selectors/project_scoped.py`, `ProjectNoteService` |
| 2.5 | **Permissions and events.** `note.update` and `note.delete` in `NotePermissions` and the `init_platform` catalog, granted as Q-RP-11 and Q-RP-12 say. `NoteCreated`, `NoteReplied` and `NoteStatusChanged` domain events in `apps/production/events/`, published after commit (RP-6 subscribes; nothing does in RP-2). ~~Every write is in the audit trail, as `create_note` already is.~~ Corrected: notes were never in the change log (see below). | `constants/permissions.py`, `core/management/commands/init_platform.py`, `events/` |
| 2.6 | **Back-fill links** for existing notes. A data migration adds a `ProjectNoteLink` only where the stored `entity_type` is in the list and `entity_id` is the UUID of a record in the note's own project (archived records included, so history is kept). Nothing else is changed, and the `entity_*` columns stay. A read-only `STAGING_AUDIT_RP2.sql` counts the notes that will not get a link, to be run before the migration, as in RP-1. | migration 0006, `docs/review-pipeline/STAGING_AUDIT_RP2.sql` |
| 2.7 | **Frontend follow-up.** Threads with replies in the project Notes tab and the shot and asset Notes tabs; link chips; a record picker (several records) and a task picker in the add dialog; Address, Close and Reopen; edit and delete where allowed (`useCan` plus authorship). The shot and asset tabs read with `entity_type` + `entity_id` and drop the search-and-filter. A Notes tab on the version workspace. Captures refreshed from the test database. | `frontend/src/api/production/structure.ts`, `EntityNotes.tsx`, `structure/panels.tsx`, the version workspace |

### Corrections found while building

1. **Notes are not in the change log, and RP-2 does not add them.** `apps/audit/signals/change_tracking.py` tracks a fixed list of models, and `ProjectNote` was never on it; the plan was wrong to say `create_note` was audited. Adding it would copy each note's subject and body into change-log rows. Any `audit.view` holder on the project can read those rows, including members bound to a show or a department, who get 404 on every notes route. That would widen who reads notes, so it needs its own decision: a proposed follow-up, not part of RP-2.
2. **Narrowed members never reach the notes routes.** The routes need whole-project access (`user_has_full_project_access`), so members bound to a show or a department get 404, as for the list before RP-2. Q-RP-13 = A ("unchanged") holds trivially, and the tests check the 404 rather than a narrowed list. The link check still applies the caller's narrowing, and that is tested on the validator.

### Questions before RP-2 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-11 | Who may edit a note, and who may address, close or reopen it? | A: the author edits their own note's text; status changes by the author, the assignee of the note's task, or a holder of the new `note.update` (production-admin, org-admin, platform-admin, vfx-supervisor, lead). Others' text needs `note.update`. B: only `note.update` holders. | **A**: the artist on the task can mark a note addressed, which is what the status is for. |
| Q-RP-12 | Delete? | A: soft delete, by the author while the thread has no replies from others, or by a holder of `note.delete` (production-admin, org-admin, platform-admin, vfx-supervisor); a thread's replies go with it. B: no delete in RP-2. | **A**: soft delete keeps the audit trail. |
| Q-RP-13 | What can a narrowed member (show- or department-bound) see? Today: only the notes they wrote. | A: unchanged, plus every reply on their own threads. B: also the notes linked to records they can see. | **A**: no change to the trust model, so no ADR. B can come later with its own contract. |
| Q-RP-14 | Which records can a note link to? | A: Sequence, Shot, Asset, Version, Playlist, Review (and Episode on episodic projects). The task is its own field, not a link. B: also Task as a link. | **A**: one way to name the task. |

### Not in RP-2

- Review comments stay their own records (Q-RP-4 = B). No merge, no copy between the two.
- Notifications on a note or a reply are RP-6; RP-2 only publishes the events.
- Attachments on notes (CR-52 covers versions only).
- Mentions (`@name`) are RP-6.
- Partial (client, vendor) members still get 404 on the notes routes (`external_allowed=False`), as today.

### Tests (targeted, test database)

- Links and task on create: one, several and none; the old `entity_type` + `entity_id` pair; the 20 cap; a duplicate is stored once; code and name come from the record, never from the request; a record of another project, an archived one, a malformed id and one outside the writer's narrowing each get the same 400; a task of another project is 400; `status: "Closed"` on create still gives `Open`.
- List: replies are not listed; `reply_count` counts only live replies; `entity_type` + `entity_id` matches the first link and any other link; `task_id` and `status` filters; an unknown or malformed value gives an empty list, not a 400; show-bound, department-bound, vendor and non-members get 404 on every notes route (correction 2).
- Detail and reply: replies in order; a reply to a reply is stored on the root; a reply inherits the thread's project and takes no links or task; a reply to a deleted note, or to a note the caller cannot see, is 404.
- Edit, status and delete follow the answers to Q-RP-11 and Q-RP-12, including the 403 for someone with neither the right nor authorship; `addressed_by` and `addressed_at` are set by the server and cleared on reopen.
- Events are published after commit, once per write, and not on a failed write.
- The back-fill migration: a resolvable note gets one link; an unresolvable one (unknown id, another project's record, a malformed id, `Project` type) gets none; it can be run twice.
- Role matrix: the new grants are what Q-RP-11 and Q-RP-12 say, and `init_platform` stays idempotent.
- The OpenAPI schema changes only in the places listed in C-RP-07 to C-RP-13.

Mutation checks: skip the project check on a link; skip the narrowing check; take `entity_code` from the request; list replies as threads; let the author of a note change another person's note; forget to clear `addressed_at` on reopen; publish an event before commit. Each must make a test fail.

### Gates

The same as RP-1, plus a browser role smoke: an artist replies to a supervisor's note on a shot and marks it addressed; a show-bound member does not see the thread.

### Release notes (draft)

- *Upgrading:* two migrations (new columns and a table; then a data-only back-fill). Run `STAGING_AUDIT_RP2.sql` first to see which notes keep no link. Rerun `init_platform` to grant `note.update` and `note.delete`.
- *API:* notes have replies, several links and an optional task, and can be read one by one, edited, addressed, closed, reopened and deleted. The list shows threads only. The server, not the client, writes a link's code and name.

## RP-3 Approval roll-up (fixed rule, per project)

**Status:** approved 2026-11-12, every recommendation taken (Q-RP-15 to Q-RP-18 = A, [DECISIONS.md](DECISIONS.md#rp-3-answers)). Built on `feature/rp-3-approval-rollup` (`4fee267e`), off `develop` at `94cb2359`, and merged into `develop` as `745e6cb3`, not pushed ([rp-3-verification.md](rp-3-verification.md)). There is no `docs/apps/production.md` page, so WP 3.4 documents the rule in C-RP-15 and the release notes only. Q-RP-5 = A ([DECISIONS.md](DECISIONS.md)): a fixed rule, switched on per project, and no `AutomationRule` engine.

### Why (what is there today)

- `StatusService.transition_status` (`apps/production/services/status.py`) is the only code that changes a status. It writes `StatusHistory` and publishes `StatusChanged`, which the core bus dispatches after commit. **Nothing subscribes to it** (ANALYSIS.md §4).
- A version reaches `Approved` three ways: a status change (`PATCH versions/{id}/`), the bulk status change (`base.py` `_apply_update`), and `POST versions/{id}/promote/` (`services/version.py`). Each one needs `version.publish` and separation of duties (the version's producer may not approve it). Approving a **review** does not approve its versions, and RP-3 does not change that.
- A task's workflow (`constants/workflow.py`) lets `Approved` be entered from `Pending Review` only, and left only to `Archived`. Entering it needs no extra code.
- The project has no per-project switches today; studio settings (`apps/settings`) are global. The switch is therefore a new project field.
- The bus dispatches synchronously when the transaction commits, and there is no `ATOMIC_REQUESTS`. A handler that raised would turn an approval that is already saved into a 500. The roll-up must never raise.

### Work packages

| WP | Change | Files (`backend/apps/production/` unless named) |
|---|---|---|
| 3.1 | **The switch.** `Project.approve_task_on_version_approval` (boolean, default `false`), migration `0007`. It is in every project response and writable on create and update (C-RP-14). The clone copies it if it copies the project's other settings (checked while building). `apps/core/tests/test_bootstrap.py` allows `production` seven migrations. | `models/project.py`, `migrations/0007_…`, `api/serializers/project/*.py` |
| 3.2 | **The roll-up** (C-RP-15). A `StatusChanged` handler, registered in `events/__init__.py`, acts only on a `Version` moving to `Approved`. It calls `ApprovalRollupService.roll_up(version_id, actor_id)` in a transaction of its own. That re-reads the version, which must still be `Approved` and live with a live task, and the project, which must have the switch on. If so, it moves the task to `Approved` through `StatusService.transition_status(enforce=False)`, from any state Q-RP-15 allows. The history row names the approver and the reason `Version <code> approved`. It carries no override kind, because no fence was crossed by a person. Any error is logged (`approval_rollup_failed`, with the ids) and swallowed. | new `services/approval_rollup.py`, new `events/handlers.py`, `events/__init__.py` |
| 3.3 | **Frontend.** The switch on the project form and the project overview ("Approve the task when one of its versions is approved"). After a version is approved or promoted, the task queries are refetched, so the task's status and history show the roll-up. A capture tool, and the samples it writes. | `frontend/src/api/production/structure.ts`, the project form config, `review/VersionWorkspace.tsx` and the version status actions |
| 3.4 | **Docs.** CONTRACTS (C-RP-14, C-RP-15), release notes, `docs/apps/production` (the rule), verification report. No data step: the switch starts off. | `docs/review-pipeline/`, `docs/apps/` |

### Questions before RP-3 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-15 | The version is approved while its task is not in `Pending Review` (`Not Started`, `In Progress`, `Retake`). | A: the task moves to `Approved` from any working state; `Approved` and `Archived` tasks are left alone. B: only from `Pending Review`; otherwise nothing happens (logged). | **A**: the version's approval is the review. With B, the rule works only when someone has already moved the task to `Pending Review` by hand. |
| Q-RP-16 | After the roll-up, the version leaves `Approved` (it is unapproved, sent to `Retake`, or a later version is sent back). | A: the task is not touched. Its `Approved` is corrected by hand, with `production.status.override` and a reason, as today. B: the task goes back to the state it had before the roll-up. | **A**: a rule that only ever approves is easy to reason about. Undoing would need to know whether a person approved the task as well. |
| Q-RP-17 | The default, and who sets the switch. | A: off for every project, old and new; set on the project form by whoever may edit the project (`project.update`, or `project.create` when creating it). B: on for new projects. | **A**: nothing changes on deploy, and each production opts in. |
| Q-RP-18 | Which version's approval counts. | A: any live version of the task. B: only the task's newest live version (highest `version_index`). | **A**: approving a version is already a deliberate act by a holder of `version.publish`. A supervisor who picks v001 over v002 means it. |

Who causes the change: the approver needs `version.publish` but not `task.update`, so the roll-up can approve a task the approver could not have approved by hand. This is the rule the owner chose (Q-RP-5). The approver can only reach versions inside their own narrowing, and a version's task is on the same shot or asset, so the roll-up stays within it. The history row says who approved the version, and the trust model is unchanged, so no ADR is needed.

### Not in RP-3

- Approving a review does not approve its versions, and the review's verdicts are not rolled up.
- No roll-up from tasks to the shot or asset ("every task approved, so the shot is approved").
- No `Retake` roll-up (version `Retake` → task `Retake`). It can be added later as a second switch.
- No `AutomationRule` engine (Q-RP-5 = A). The stored rules stay data only.
- No notification about the roll-up: that is RP-6, which can subscribe to the task's `StatusChanged`.

### Tests (targeted, test database)

- Switch off (the default): approving a version leaves its task alone, by every route (PATCH, bulk status, promote).
- Switch on: by each route, the task moves to `Approved` from each state Q-RP-15 allows; an `Approved` or `Archived` task, a deleted task, and a version without a task are left alone; other version moves (`Retake`, `Pending Review`, …) do nothing; a `Shot` or `Task` moving to `Approved` does nothing.
- The history row on the task: the approver's id, the reason `Version <code> approved`, no override kind. One `StatusChanged` for the task. Running the roll-up twice changes nothing more.
- The approver holds `version.publish` and not `task.update`: the task is still approved (the rule decides, see above). A project with the switch on does not affect another project with it off.
- A failure inside the roll-up (forced in the test) leaves the version approved, still answers 200, and logs `approval_rollup_failed`.
- C-RP-14: the field is in every project response, defaults to `false`, is writable with `project.update` and refused without it, and is not a member-only or budget-like secret (it is visible to every reader of the project).
- Migration-chain test, role matrix unchanged, `init_platform` unchanged.

Mutation checks: ignore the switch; roll up from `Archived`; roll up on `Retake`; let a handler error escape; act on a `Shot` approval; drop `enforce=False` (the `In Progress` test must fail); write the history without the reason. Each must make a test fail.

### Gates

The same as RP-2. The browser role smoke adds one step: a supervisor approves a version on a project with the switch on, and its task shows `Approved` with the roll-up in its history.

### Release notes (draft)

- *Upgrading:* one migration, which adds a column with a default, and no data step. The rule starts off for every project.
- *New:* a project can approve a task automatically when one of its versions is approved. The task's history records who approved the version.

## RP-4 Publishing depth (dependencies, loader, path templates)

**Status:** approved 2026-11-12, every recommendation taken (Q-RP-19 = A, Q-RP-20 = A, Q-RP-21 = B, Q-RP-22 = B, Q-RP-23 = A, [DECISIONS.md](DECISIONS.md#rp-4-answers)). Built on `feature/rp-4-publishing-depth` ([rp-4-verification.md](rp-4-verification.md)); one migration, not two, and a template mismatch is a plain field error (CONTRACTS, "Details settled while building RP-4"). Branch `feature/rp-4-publishing-depth`, off `develop` at `745e6cb3` (RP-3 merged, not pushed). It is independent of RP-1 to RP-3 ([DECISIONS.md](DECISIONS.md#phases-after-the-answers)). It reverses publishing Q5 for dependencies (Q-RP-2 = A); `docs/publishing/PLAN.md` §3 already names the model.

**Goal.** Three ShotGrid / ftrack features: a published file says which files it was built from, and which files were built from it; a pipeline tool asks "the latest (or approved, or hero) file of type T for this shot, asset or task" in one call; and a project can say where a file of a given type should live.

### Why (what is there today)

- `PublishedFile` (`apps/publishing/models/file.py`) is immutable once registered. Only the lifecycle and checksum fields change, and a `save()` guard plus a queryset guard refuse anything else (DOM-PUB-02 invariant 2). A dependency stored on the file itself would break that, so dependencies are their own table.
- "Latest" exists only **per version and role** (`PublishedFileSelector.only_latest`, `?latest=1`). No route goes from a shot, asset or task to its files across versions. A tool has to list the versions, pick one, then list that version's files.
- `version_index` is unique per task, and per shot or asset for versions with no task (`production_version_{task,shot,asset}_index_uniq`). That is the "stream" the loader picks the newest version in. Indexes of two tasks on one shot are not comparable.
- `relative_path` is free text, checked only by the path rules (DOM-PUB-03). Nothing says what it should be. `MasterFileType` has `extension`, which a template can use.
- Published files are read only by **full** members (`visible_project_ids`). A show-bound, department-bound or client/vendor member sees no file (SEC-PUB-01). The loader and the dependency reads follow the same rule.
- Registration needs `publishing.create` (platform-admin, org-admin, production-admin, vfx-supervisor, lead-artist). Reads need `publishing.view` (every internal role but org-member).

### Work packages

| WP | Change | Files (`backend/apps/publishing/` unless named) |
|---|---|---|
| 4.1 | **Dependencies** (C-RP-16). `PublishedFileDependency(downstream, upstream, created_at, created_by)`, both `PROTECT` to `PublishedFile`. The pair is unique; a file never depends on itself (DB check). Append-only, like `PublishedFileEvent`. The registration body (single and bulk) gains `upstream_ids`, at most 50. Each upstream must be a live, visible file of the same project (Q-RP-20), not `Revoked`. An unknown, foreign or revoked one is a 400 naming it, and nothing is registered. An identical retry must send the same upstreams, or it is a 409, as any other difference is. `GET files/{id}/dependencies/` answers `{upstream: [...], downstream: [...]}`, direct links only, each with its id, path, role, file type, status, version id and code. The file detail gains `upstream_count` and `downstream_count`. Migration `0003`. | `models/dependency.py`, `migrations/0003_…`, `services/files.py`, `api/serializers/file.py`, `api/viewsets/file.py`, `admin/files.py` (read-only) |
| 4.2 | **Loader** (C-RP-17). `GET files/loader/?shot=` or `asset=` or `task=` (exactly one), optional `file_type` (code), `role` (default `main`), `which` = `latest` (default), `approved` or `hero` (Q-RP-21). For each stream (the task, or the shot or asset for versions with no task) and each file type and role, it answers one file. It takes the newest live, published version of the stream (highest `version_index`) that has a `Registered` file of that type and role (`approved`: whose status is `Approved`; `hero`: the hero version). It picks that version's latest file (`only_latest`). Rows carry the file, the version (id, code, index, status, `is_hero`) and the task (id, code). Narrowed like every file read; an entity outside the caller's reach is a 404 identical to an unknown id. A selector method, no new table. | `selectors/files.py`, `api/viewsets/file.py`, `api/serializers/file.py` |
| 4.3 | **Path templates** (C-RP-18). `PublishPathTemplate(project nullable, file_type, role, storage_root, pattern, enforce, is_active)`. A row without a project is the studio default, and a project's own row for the same type and role overrides it (Q-RP-23). Pattern tokens: `{project}`, `{episode}`, `{sequence}`, `{shot}`, `{asset}`, `{asset_type}`, `{task}`, `{department}`, `{version}` (`{version:03}` pads), `{ext}` (the file type's extension), `{frame}` (`%04d`, `{frame:4}` sets the width), and `{name}` (free text, one segment of letters, digits, `_`, `-`, `.`). An unknown token, a pattern whose sample render breaks DOM-PUB-03, or a second active row for one key is a 400. `GET files/resolve-path/?version_id=&file_type=&role=` answers the storage root and the path with `{name}` left in, or 404 when no template applies. With `enforce` on (Q-RP-22), a registration whose root or path does not match is a 400 `path_template_mismatch` that shows the expected pattern. Managed at `/publishing/path-templates/` with `publishing.template.manage` (new). Migration `0004`. | `models/template.py`, `domain/templates.py` (pure), `services/templates.py`, `services/files.py`, `api/viewsets/template.py`, `api/serializers/template.py`, `api/routers.py`, `constants/permissions.py`, `backend/apps/core/management/commands/init_platform.py` |
| 4.4 | **Frontend.** The file page shows its upstream and downstream files as links, with a status pill (a revoked upstream stands out). The project's Publishing tab gets a "Path templates" list and form (studio defaults on the publishing settings page), gated on `publishing.template.manage`. The loader has no screen: it is for pipeline tools. A capture tool and its samples. | `frontend/src/api/publishing/`, `modules/publishing/FilePages.tsx`, `modules/production/components/project-tabs/ProjectPublishingTab.tsx`, `docs/sync/tools/` |
| 4.5 | **Docs.** `docs/publishing/CONTRACTS.md` (DOM-PUB-07 dependencies, DOM-PUB-08 templates, API-PUB-18 to API-PUB-21), review-pipeline CONTRACTS (C-RP-16 to C-RP-18), the role table, the stale "no Celery app" docstring in `tasks/verify.py` (ANALYSIS §7), release notes, verification report. | `docs/publishing/`, `docs/review-pipeline/` |

### Questions before RP-4 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-19 | When are dependencies written? | A: only when the downstream file is registered, and never changed afterwards. B: also added and removed later, through their own route. | **A**: it matches the rule that a registered file never changes. And because every upstream exists before its downstream, no cycle can form, so there is no cycle check and no lock. B needs both, plus a history of edits. A wrong dependency is corrected as a wrong path is: revoke and register again. |
| Q-RP-20 | Can a file depend on a file of another project (a shared library asset)? | A: same project only. B: any project the registrant is a full member of. | **A**: every reader of the downstream can then see its upstreams. With B, a reader would see a dependency on a file they may not read, and the answer would need a placeholder. B can be added later. |
| Q-RP-21 | What can the loader pick? | A: `latest` and `approved`. B: also `hero`. | **B**: the hero is already "the current version" of a shot or asset (`is_hero`). It costs one filter. |
| Q-RP-22 | Does a template refuse a registration that does not match it? | A: never: templates only advise, through `resolve-path`. B: a switch on each template, `enforce`, off by default. C: always, when a template applies. | **B**: nothing changes for tools already registering files until a studio turns a template's switch on. C would break tools on the day a template is saved. |
| Q-RP-23 | Who manages templates, and at which level? | A: studio defaults plus per-project overrides, managed with a new code `publishing.template.manage` (platform-admin, org-admin, production-admin). B: per project only, managed with `project.update`. | **A**: most studios keep one layout and change it for a few shows. A publishing code keeps the rule inside the app that owns paths. |

Also decided in the plan, without a question:
- An upstream may be `Deprecated` but not `Revoked`. Revoking an upstream later changes nothing on the downstream; its dependency read shows the upstream's status.
- The loader answers one file per stream and per file type and role. It does not read across streams: comp and lighting on one shot are two rows.
- Templates are checked when a file is registered, never against files already registered. Changing a template does not move or flag old files.

Who causes the change: dependencies are written by whoever registers the file (`publishing.create`), templates by `publishing.template.manage`, and the loader reads with `publishing.view`. Nothing widens what a member can see (the same full-member rule as every file read), so the trust model is unchanged and no ADR is needed.

### Not in RP-4

- No dependency between versions (only between files), no graph walk deeper than one step in one call, no automatic revoke of downstream files.
- No renaming or moving of registered files to match a template.
- No DCC loader or publisher tool (RP-9, a separate repository, Q-RP-10 = B). RP-4 gives them the routes.
- No `PublishItem` (export job) change.

### Tests (targeted, test database)

- Dependencies: registered with upstreams (single and bulk), read both ways; self, duplicate, unknown, other project's, revoked and not-visible upstreams refused with nothing registered; a deprecated upstream accepted; an identical retry with the same upstreams is a 200 and with other upstreams a 409; the table refuses update and delete; the read is narrowed (a show-bound member gets a 404 as for the file).
- Loader: each selector (`latest`, `approved`, `hero`) on shot, asset and task; newest version by `version_index` within a stream; a version without the file type is skipped for the next one down; deprecated and revoked files, unpublished and deleted versions are skipped; two streams on one shot give two rows; exactly one of `shot`, `asset`, `task` (400 otherwise); an entity in another project or out of reach is a 404; query count bounded.
- Templates: each token renders; padding and frame width; `{name}` matching; unknown token and a pattern that breaks DOM-PUB-03 refused; one active row per key; the project's row overrides the studio's; `resolve-path` (found, 404); `enforce` off accepts any path, on refuses a mismatch with `path_template_mismatch` and accepts a match (single and bulk); `publishing.template.manage` held by the three roles only (permission matrix), and refused without it.
- Role matrix, `init_platform` grants the new code. (`publishing` is not in the migration-count test of `apps/core/tests/test_bootstrap.py`, so its two new migrations need no change there.)

Mutation checks: allow a revoked upstream; allow another project's upstream; let a retry ignore its upstreams; pick the version by date instead of `version_index`; let the loader return a deprecated file; drop the `approved` status filter; let a studio template win over the project's; skip `enforce`; let `{name}` match a `/`. Each must make a test fail.

### Gates

The same as RP-3, plus `apps/publishing` and `apps/deliveries` in full (Deliveries reads files through the publishing selectors).

### Release notes (draft)

- *Upgrading:* two additive migrations, no data step. Rerun `init_platform` to grant `publishing.template.manage`.
- *New:* a published file records the files it was built from; pipeline tools can ask for the latest, approved or hero file of a type for a shot, asset or task; projects can define where files of each type live, and optionally refuse files registered elsewhere.

## RP-5 and RP-6

Not planned in detail yet. Each phase is written here before it starts, from [ANALYSIS.md §8](ANALYSIS.md#8-draft-phases-to-be-fixed-after-9-is-answered) and [DECISIONS.md](DECISIONS.md).
