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

**Status:** approved 2026-11-12, every recommendation taken (Q-RP-19 = A, Q-RP-20 = A, Q-RP-21 = B, Q-RP-22 = B, Q-RP-23 = A, [DECISIONS.md](DECISIONS.md#rp-4-answers)). Built on `feature/rp-4-publishing-depth` ([rp-4-verification.md](rp-4-verification.md)), merged into `develop` as `8629ac83` and pushed (2026-11-13); one migration, not two, and a template mismatch is a plain field error (CONTRACTS, "Details settled while building RP-4"). Branch `feature/rp-4-publishing-depth`, off `develop` at `745e6cb3` (RP-3 merged, not pushed). It is independent of RP-1 to RP-3 ([DECISIONS.md](DECISIONS.md#phases-after-the-answers)). It reverses publishing Q5 for dependencies (Q-RP-2 = A); `docs/publishing/PLAN.md` §3 already names the model.

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

## RP-5 Media pipeline (review movies, thumbnails, filmstrips)

**Status:** approved 2026-11-13, every recommendation taken (Q-RP-24 to Q-RP-31 = A, [DECISIONS.md](DECISIONS.md#rp-5-answers)). WP 5.1 to 5.6 built 2026-11-13 (`66827941`), merged into `develop` as `a946f666` and released in v4.6.0 ([rp-5-verification.md](rp-5-verification.md)); the package is `transcode/`, not `media/`, and the job is queued through `core.celery` (CONTRACTS, "Details settled while building RP-5"). Branch `feature/rp-5-media-pipeline`, off `develop` at `8629ac83` (RP-4 merged and pushed). It is independent of RP-1 to RP-4 ([DECISIONS.md](DECISIONS.md#phases-after-the-answers)). Q-RP-6 = A: ffmpeg runs in the worker image, and its results are written to a storage root.

**Goal.** ShotGrid's "upload a movie to a version": someone uploads a review movie (or a still) to a version; a background job makes a web proxy the browser can play frame by frame, a thumbnail and a filmstrip, and reads the frame count, rate and size. The version page and the review player then play the proxy, with no link pasted by hand.

### Why (what is there today)

- **Nothing makes a playable file.** `Version.video_url` and `thumbnail_url` (`apps/production/models/version.py`) are `URLField`s a person fills with a link. `Media` (`models/media.py`) is a record of links too; the frontend says so ("The studio records the links; it does not store the files"). No code calls ffmpeg, ffprobe or OIIO, and the image installs none.
- **The player plays a URL.** `VersionMedia.tsx`, `ReviewViewer.tsx` and `VersionExtras.tsx` play `version.video_url` with `thumbnail_url` as the poster, and take `version.fps` and `start_frame` for frame numbers. A server-made proxy only has to arrive as a URL there.
- **A browser cannot send the token with `<video src>`.** Attachments already solve this (`apps/core/api/views/attachment_download.py`): a signed, short-lived link (`attachment_links`, 300 s) names the user; every use re-checks the user and their access; the file leaves through nginx's `internal` location `/_protected_media/` (`X-Accel-Redirect`, `MEDIA_ACCEL_PREFIX`) or, without it, a Django `FileResponse`. nginx refuses every other `/media/` path (404), except avatars and branding.
- **Seeking needs HTTP Range.** nginx answers ranges for an `X-Accel-Redirect`. Django's `FileResponse` does not (Django 6.1 has no Range support), so without `MEDIA_ACCEL_PREFIX` a browser can play a movie but not seek in it.
- **The worker cannot see uploads.** In `compose.prod.yml`, `django` mounts `media_volume` at `/app/media` and nginx at `/media` (read-only); `celery` and `celery-beat` mount no media volume. All three use one image (`infrastructure/docker/django/Dockerfile`, one runtime stage). `start-celery.sh` consumes the default queue only. `CELERY_TASK_TIME_LIMIT` is 30 minutes.
- **Flags nobody reads.** `media_proxy_generation`, `media_auto_transcode`, `video_proxy_generation` and `video_auto_transcode` (`apps/settings/constants/feature_flags.py`) are only names: no code outside `apps/settings` reads any feature flag.
- **Uploads have limits already.** Attachments take at most 512 MiB (`ATTACHMENT_MAX_BYTES`), with an extension allowlist, and nginx lets large bodies through only on the attachment route (`client_max_body_size 520m`).
- **Who reads a version.** Full members, and client and vendor members narrowed to the reviews they take part in and those reviews' versions (`external_scope.py`). Writing a version needs `version.update`.

### Work packages

| WP | Change | Files (`backend/apps/production/` unless named) |
|---|---|---|
| 5.1 | **Record and upload** (C-RP-19). `ReviewMedia(project, version, kind = movie / still, status = queued / processing / ready / failed / superseded / removed, source_name, source_path, source_size, source_sha256, probe JSON, proxy_path, thumbnail_path, filmstrip_path, filmstrip_tiles, error_code, error_message, attempts, queued_at, started_at, finished_at, created_by)`. At most one row in flight (queued or processing) and one `ready` row per version (partial unique constraints). `POST versions/{id}/review-media/` (multipart `file`) with `version.update` and the version in reach: off (Q-RP-27) is a 409 `review_media_disabled`; too large, a refused extension, or content whose first bytes do not match an allowed container is a 400 on `file`; a job already in flight is a 409 `review_media_busy`. The file is stored under `MEDIA_ROOT/review_media/<project>/<version>/<row id>/` with a server-made name, hashed while it is written, and the job queued after commit. `GET versions/{id}/review-media/` lists the version's rows, newest first. Audit rows for upload, retry and remove. Migration `0008`. | `models/review_media.py`, `migrations/0008_…`, `services/review_media.py`, `selectors/review_media.py`, `api/serializers/review_media.py`, `api/viewsets/review_media.py`, `api/urls.py`, `admin/` (read-only), `backend/config/settings/components/storage.py`, `backend/config/env.py` |
| 5.2 | **Processing** (C-RP-20). Celery task `production.process_review_media` on its own queue `media` (`acks_late`, soft limit 25 min). It runs `ffprobe` and `ffmpeg` as argument lists (never a shell), with the demuxer forced from the detected container and `-protocol_whitelist file`, in a temporary directory, and moves the results into place only when all three are made. Movie: an H.264 MP4 proxy (yuv420p, at most 1920 wide, the source's constant frame rate, a key frame every second, AAC audio when there is any, `+faststart`), a JPEG thumbnail of the middle frame (480 wide), a filmstrip of up to 60 evenly spaced frames (one JPEG, 240 wide each). Still: a JPEG proxy (at most 1920 wide) and a thumbnail; no filmstrip. Probe: width, height, frame rate, frame count, duration, codec, audio. On success the row is `ready`, the previous `ready` row becomes `superseded` and its files are deleted. A failure is `failed` with a code (`probe_failed`, `unsupported_stream`, `transcode_failed`, `timeout`, `source_missing`) and a fixed message of ours; ffmpeg's own output goes to the log, never into a response. `POST review-media/{id}/retry/` requeues a failed row (at most 3 attempts). A beat task marks rows stuck in `processing` for more than 45 minutes as `failed` (`timeout`). | `tasks/review_media.py`, `transcode/ffmpeg.py` (the commands, pure), `transcode/detect.py` (first bytes to container), `services/review_media.py`, `backend/config/settings/components/celery.py` (route and beat entry) |
| 5.3 | **Serving** (C-RP-21). The version shape (list and detail) gains `review_media` (the `ready` row, or `null`) and `review_media_job` (the newest row still `queued`, `processing` or `failed`, or `null`). A ready row carries signed links `proxy_url`, `thumbnail_url` and `filmstrip_url` and `links_expire_at`. `GET review-media/{id}/{output}/?token=` (output = `proxy`, `thumbnail`, `filmstrip`) checks the token (user, row, output, expiry), then that the user is still active and still reads the version (the same narrowing as `GET versions/{id}/`), and that the row is still `ready`; any failure is a 404. The file leaves through `X-Accel-Redirect` when `MEDIA_ACCEL_PREFIX` is set, otherwise through Django with single-range support (206, 416), so seeking also works in development. Fixed content type (`video/mp4` or `image/jpeg`, from what we wrote, never from the upload), `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cache-Control: private, no-store`. The source upload is never served. `DELETE review-media/{id}/` (`version.update`) removes a ready movie: the files are deleted and the row is kept as `removed`. | `api/views/review_media_stream.py`, `services/review_media_links.py`, `api/serializers/version/*.py`, `api/viewsets/review_media.py` |
| 5.4 | **Worker image and deployment.** A `worker` stage in the Django Dockerfile (`FROM runtime`, plus Debian's `ffmpeg`). A new `celery-media` service in `compose.prod.yml` and `compose.dev.yml`: the `worker` target, `media_volume` mounted, `-Q media`, concurrency from `REVIEW_MEDIA_CONCURRENCY` (default 1). The general worker keeps the default queue only and gets no ffmpeg. nginx: a location for `^/api/v1/versions/<id>/review-media/$` that takes bodies up to the upload limit (like the attachment route). CI: the backend job installs `ffmpeg` with apt, so the tests that run the real ffmpeg run there (they skip where it is missing). Settings: `REVIEW_MEDIA_ENABLED` (default `false`), `REVIEW_MEDIA_MAX_BYTES` (default 2 GiB), `REVIEW_MEDIA_LINK_TTL_SECONDS` (Q-RP-28), `REVIEW_MEDIA_CONCURRENCY`. `check --deploy` warns when the feature is on and `MEDIA_ACCEL_PREFIX` is empty. | `infrastructure/docker/django/Dockerfile`, `infrastructure/docker/django/start-celery-media.sh`, `infrastructure/compose/compose.{prod,dev}.yml`, `infrastructure/docker/nginx/default.conf`, `.github/workflows/ci.yml`, `backend/config/env.py`, `backend/.env.example` |
| 5.5 | **Frontend.** The version page gets a "Review movie" panel: upload (with `version.update`), the job's state while it runs (the version is refetched every 5 seconds while a job is queued or processing), the failure message with Retry, Replace and Remove. The player, the review viewer and compare prefer `review_media.proxy_url` (poster: its thumbnail; frame rate: its probe) over `video_url`; frame numbers still start at `version.start_frame`. Version cards and lists show the generated thumbnail when the version has none of its own, and scrub the filmstrip on hover. A link that has expired is fetched again (the version query is refreshed before `links_expire_at`). A capture tool and its samples, run with a real ffmpeg. | `frontend/src/api/production/{review,work,*RowKeys}.ts`, `modules/production/review/{VersionMedia,ReviewViewer,VersionExtras}.tsx`, a new `modules/production/review/ReviewMoviePanel.tsx`, `docs/sync/tools/` |
| 5.6 | **Docs.** An ADR for running ffmpeg on uploaded files (what is accepted, the sandbox rules, how files leave); CONTRACTS (C-RP-19 to C-RP-22); the production app's contracts (`docs/production/`); the pre-deploy checklist (the worker image, the volume, `MEDIA_ACCEL_PREFIX`, the nginx location, the switch); release notes; verification report. | `docs/adr/ADR-0040-review-media-processing.md`, `docs/review-pipeline/`, `docs/07-deployment/` |

### Questions before RP-5 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-24 | Where do uploads and results live? | A: under `MEDIA_ROOT` (the `media_volume` that Django and nginx already mount), in `review_media/`, leaving only through signed links, as attachments do. B: on a publishing storage root with a mount (`PUBLISHING_STORAGE_MOUNTS`), served through its own nginx location. | **A**: nginx already serves `MEDIA_ROOT` only through the internal location, so seeking, access checks and headers come with it; the media worker only needs the same volume. B needs a new nginx location per root and puts server-made files among the pipeline's published files. Object storage stays for later (Q-RP-6). |
| Q-RP-25 | What can a job start from? | A: a file uploaded to the version. B: also a registered published file (role `main` or `proxy`) on a mounted storage root, so that big files are not uploaded again. | **A** for RP-5: it is how ShotGrid's review submission works (the DCC renders a QuickTime and uploads it), and it needs no mount on the worker. B can follow; it reuses the same job. |
| Q-RP-26 | Which formats? | A: movies (`mov`, `mp4`, `m4v`, `mkv`, `webm`, `mxf`, `avi`) and display-ready stills (`jpg`, `png`, `tif`). EXR and DPX are refused: shown correctly they need OpenColorIO, which ffmpeg does not have. B: also EXR and DPX, converted without colour management. | **A**: a proxy with wrong colours misleads a review. EXR and DPX can come with OpenColorIO later. |
| Q-RP-27 | What switches it on? | A: one deployment setting, `REVIEW_MEDIA_ENABLED` (off by default), because it needs the worker image and the volume. The four feature flags stay unread. B: the settings app's `video_proxy_generation` flag, read at upload. C: a switch per project, on top of A. | **A**: a studio admin could otherwise turn on a flag on a deployment with no media worker, and jobs would wait forever. Removing the dead flags is a settings-app change, not in RP-5. |
| Q-RP-28 | How long does a playback link last? | A: one hour; every request re-checks the user and their access, so removing access ends it at once. B: 5 minutes, like attachments, with the player fetching new links. | **A**: a reviewer seeks for a long time in one movie, and every seek is a new request to the same link. A leaked link is still bound to one user, one file and one hour, and is checked again on each use. |
| Q-RP-29 | Does the probe change the version? | A: no: the version's `fps`, `start_frame`, `end_frame` and `resolution` stay as the publisher wrote them; the probe is shown beside them, and the player uses the probe's frame rate for the proxy. B: when the job is done, write the probe into the version. | **A**: those fields already have defaults (24 fps, 4096x2160), so the server cannot tell a real value from a default, and B would overwrite what a pipeline tool set. |
| Q-RP-30 | Who may upload, replace and remove? | A: `version.update`, with the version in reach. B: a new code, `version.upload_media`. | **A**: whoever may edit the version may attach its movie. A new code would need a grant on every role that edits versions. |
| Q-RP-31 | Is there a size limit per upload, or a quota? | A: a limit per upload (`REVIEW_MEDIA_MAX_BYTES`, default 2 GiB) and no quota. B: also a quota per project. | **A**: replaced movies are deleted, so storage grows with versions, not with uploads. A quota can come with a storage report. |

Also decided in the plan, without a question:
- One movie per version. A new upload replaces the ready one when its job succeeds; until then the old one keeps playing. Older rows stay (`superseded`, `removed`) for the audit trail, without files.
- Container detection reads the first bytes (`ftyp` for MP4 and MOV, EBML for Matroska and WebM, the MXF key, `RIFF…AVI`, the JPEG, PNG and TIFF signatures). The detected container must agree with the extension, and it chooses ffmpeg's demuxer: ffprobe and ffmpeg never guess the format, so a file posing as a movie cannot be read as a playlist (HLS, concat) that opens other files.
- ffmpeg runs only in the `celery-media` container, as the image's non-root user, and only reads the stored upload.
- No progress percentage, no notification when a job ends (that is RP-6), and no choice of codec or size per studio.

Who causes the change: an editor of a version uploads (`version.update`); the worker writes files; a reader of the version plays them. Nobody sees more than they see today. What is new is native code (ffmpeg) reading files that users upload, so RP-5 brings an ADR that records the limits above, as attachments' handling is recorded in their settings and views.

### Not in RP-5

- No transcode from published files on storage roots (Q-RP-25 B), no EXR or DPX (Q-RP-26 B), no OpenColorIO.
- No change to `Media` records (links stay links) and no upload to a shot or an asset.
- No account-free link (Q-RP-8 = B): every playback link names a signed-in user.
- No object storage, no CDN, no adaptive streaming (HLS or DASH).
- No removal of the dead feature flags.

### Tests (targeted, test database)

- Upload: `version.update` and reach needed (403 and 404 as for `PATCH versions/{id}/`); off is a 409 `review_media_disabled`; size, extension, a mismatch between extension and content, and an empty file refused; a second upload while one is in flight is a 409 `review_media_busy`; the job is queued only after commit; the stored name is ours; the sha256 is right; audit rows.
- Processing, with the commands mocked: success fills the probe and the paths and supersedes the old ready row (its files deleted); each failure code; a timeout; a missing source; retry allowed only on `failed` and at most 3 times; the stale-job sweep. The argument lists: the forced demuxer, `-protocol_whitelist file`, no shell.
- Processing, with the real ffmpeg (skipped where it is missing): a short generated movie gives a playable MP4 with the right frame count and rate, a thumbnail and a filmstrip of the expected size; a still; a file named `.mp4` holding an HLS playlist is refused before ffmpeg runs.
- Detection: each signature; wrong extension; truncated files.
- Serving: a good link gives the file with the fixed headers; an expired, tampered or foreign token, an inactive user, a user who lost access, a removed or superseded row are each a 404; a client member narrowed to a review reads the movie of a version in it and not of another; Range (206, 416, a full answer without one); `X-Accel-Redirect` when the prefix is set; the source is never served.
- The version shape: `review_media` and `review_media_job` in list and detail, links per caller, a bounded query count on the list.
- Role matrix unchanged; `test_bootstrap.py` allows `production` eight migrations.

Mutation checks: let ffprobe guess the format; drop `-protocol_whitelist`; accept an extension that disagrees with the content; queue before commit; keep the old ready row; skip the access re-check on a link; ignore the token's expiry; serve the upload's own content type; allow a fourth retry; let a superseded row be served. Each must make a test fail.

### Gates

The same as RP-4, plus `apps/production` in full and the backend suites of every app at the end (wider runs found the RP-2 miss); `docker build --target worker` and the compose files checked with `docker compose config`.

### Release notes (draft)

- *Upgrading:* one additive migration (`production` `0008`). To turn it on: build the image's `worker` target, run the `celery-media` service with the media volume, set `MEDIA_ACCEL_PREFIX` (needed for seeking behind nginx), take the new nginx location, then set `REVIEW_MEDIA_ENABLED=true`. Off, nothing changes.
- *New:* upload a review movie or a still to a version; the server makes a web proxy, a thumbnail and a filmstrip, and the player plays it frame by frame.

## RP-6 Notifications (in-app)

**Status:** planned 2026-11-13; approved the same day with every recommendation (Q-RP-32 to Q-RP-40 = A, [DECISIONS.md](DECISIONS.md#rp-6-answers)). Contracts C-RP-23 to C-RP-25. WP 6.1 to 6.6 built and committed 2026-11-13 on `feature/rp-6-notifications`, not merged ([rp-6-verification.md](rp-6-verification.md)); there is no single `assign/` route (the bulk one is `bulk-assign/`) and the model has no `thread_id` (CONTRACTS, "Details settled while building RP-6"). Branch `feature/rp-6-notifications`, off `develop` at `c0459cfc` (RP-1 to RP-5 merged, v4.6.0 released). It depends on RP-2 (the note events) and uses RP-3's and RP-5's events. Q-RP-7 = A: in-app only, so no e-mail and no new outward channel.

**Goal.** What ShotGrid's and ftrack's inboxes do. A person learns, inside StudioHub, that:
- someone wrote a note on their work or mentioned them;
- someone replied to a thread they are in;
- they were given a task;
- their version or task changed status;
- their review movie is ready or failed.

The bell in the header shows the unread ones. A Notifications page lists them all. Each one opens the record it is about.

### Why (what is there today)

- **Events are published, and nothing turns them into notifications.**
  - `NoteCreated`, `NoteReplied` and `NoteStatusChanged` (`apps/production/events/notes.py`) are published after commit, "for RP-6".
  - `StatusChanged` (`events/status.py`) is published for every entity. Its only subscriber is the RP-3 roll-up (`events/handlers.py`), which runs synchronously after commit and logs and swallows its own errors.
  - Payloads carry ids and status names only.
- **No event for an assignment.** `Task.assignee` (a user) is set by several paths:
  - task create;
  - `PATCH tasks/{id}/` (`api/serializers/task/update.py`);
  - `PUT tasks/{id}/`;
  - `POST tasks/bulk-assign/` (`TaskService.assign_task`; there is no single `assign/` route);
  - `POST tasks/bulk-create/` and `bulk-update/` (`ProductionBulkMixin`).

  None of them publishes anything.
- **No event when a review movie finishes.** RP-5's worker sets `ready` or `failed` and stops. RP-5 left "no notification when a job ends" for RP-6.
- **Who a notification is for already exists as fields:**
  - `Version.artist`;
  - `Task.assignee`;
  - `ProjectNote.author`, the thread's replies, and its `task`;
  - `ReviewMedia.created_by`.
- **No mentions.** RP-2 left `@name` for RP-6. A user's `username` is their e-mail (`USERNAME_FIELD = "email"`), so `@` plus a name typed in a body cannot reliably name a person.
- **Who reads what is narrowed.**
  - External (client and vendor) members read only the reviews they take part in and those reviews' versions.
  - Internal members can be narrowed to a show or a department (`selectors/internal_scope.py`).
  - A narrowed member sees only the note threads they wrote (Q-RP-13).

  A notification must not tell anyone about a record they cannot open.
- **Nothing is stored or served.**
  - The former `platform` app's notifications were removed.
  - `apps/core/services/notifications.py` is a placeholder that returns its arguments, and nothing calls it.
  - The settings app's `notification.*` settings and `notification_*` flags are names nothing reads (like the media flags in RP-5).
  - `config/asgi.py` has no websocket routes and no channel layer is configured. Production runs uvicorn (`start-prod.sh`).
- **The bell is session-only.** `Header.tsx` shows `useNotificationStore` (zustand, in memory). That list is the history of this tab's toasts (successes and errors from `notify.*`), lost on reload, under the title "Production Alerts".

### Work packages

| WP | Change | Files |
|---|---|---|
| 6.1 | **Inbox** (C-RP-23). `Notification(recipient, kind, actor, project, target_type, target_id, data, created_at, read_at)` (a note row's `target_id` is its thread). `kind` is one of `note_created`, `note_reply`, `note_status`, `note_mention`, `task_assigned`, `task_status`, `version_status`, `review_media_ready` and `review_media_failed`. `data` holds ids and status names only (`from_status`, `to_status`, `error_code`), never text a person typed. Index on (recipient, read_at, created_at). Routes, own rows only:<br>- `GET notifications/`: newest first, paginated; filters `unread`, `project_id`, `kind`.<br>- `GET notifications/unread-count/`.<br>- `POST notifications/{id}/read/` and `…/unread/`.<br>- `POST notifications/read-all/`: takes an optional `before`, so a row that arrived after the list was fetched stays unread.<br>Someone else's id is a 404. A row's labels (record code and name, the thread's subject, the actor's name) are read at answer time from the live records (Q-RP-35). A row whose target is gone, or no longer in the reader's reach, is left out of the list and the count. The check is one query per target type, through the same selectors the target's own `GET` uses. Any signed-in user may call these routes; there is no new permission code. Read-only admin. Migration `0001`. | `backend/apps/notifications/` (Q-RP-32): `models/`, `migrations/0001_…`, `selectors/`, `services/`, `api/{serializers,viewsets,urls}.py`, `admin/`; `backend/config/settings/components/apps.py`, `backend/config/v1_urls.py` |
| 6.2 | **Events and recipients** (C-RP-24). New events:<br>- `TaskAssigned` (`task_id`, `project_id`, `from_assignee_id`, `to_assignee_id`, `actor_id`), published by every path above that changes the assignee;<br>- `ReviewMediaFinished` (`review_media_id`, `version_id`, `project_id`, `status`, `error_code`, `created_by_id`), published by the worker when a row reaches `ready` or `failed`.<br>Handlers in the notifications app subscribe to these two and to the note and status events. Recipients follow the table below. For each recipient:<br>- the target must be in their reach when the row is written;<br>- the actor is never notified of their own action;<br>- one person gets one row per event (`note_mention` wins over the other kinds).<br>One bulk insert per event, synchronous after commit, as the roll-up does. A failure is logged as `notification_fanout_failed` and never fails the action that caused it. | `backend/apps/production/events/{tasks,review_media}.py`, `services/task.py`, the task serializers and bulk path, `tasks/review_media.py`; `backend/apps/notifications/{events,services}/` |
| 6.3 | **Mentions** (C-RP-25). Note create, reply and edit accept `mention_ids` (Q-RP-34): users who are active members of the project and can read the thread; anyone else is a 400 on `mention_ids`. Mentions are stored as rows (`ProjectNoteMention`), and the note shape gains `mentions` (`[{id, name}]`). An edit notifies only the people it adds. The body text is not parsed. Migration `production` `0009`. | `backend/apps/production/models/project_note.py`, `migrations/0009_…`, `services/project_note.py`, `api/serializers/project_note*.py` |
| 6.4 | **Retention.** A daily beat task `notifications.purge` deletes rows older than `NOTIFICATIONS_RETENTION_DAYS` (default 90, Q-RP-38), in batches. | `backend/apps/notifications/tasks/`, `backend/config/settings/components/celery.py`, `backend/config/env.py`, `backend/.env.example` |
| 6.5 | **Frontend.** An API module and row keys from captured responses. The bell shows the server inbox (Q-RP-39):<br>- the unread count, fetched every 60 seconds while the tab is visible and again on focus (Q-RP-36);<br>- the latest 20 rows, each with its actor, what happened, the record, and the time through `studioLocale`;<br>- a click opens the record (note thread, task, version page, Media tab) and marks the row read;<br>- "Mark all read", which sends `before`.<br>A Notifications page (`/notifications`) has unread and kind filters and paging. The note composer gets a member picker for mentions, and threads show who is mentioned. Toasts stay as they are; the session list of toasts leaves the bell. | `frontend/src/api/notifications/`, `layouts/Header.tsx`, a new `modules/notifications/`, `modules/production/notes/*`, `shared/stores/useNotificationStore.ts`, routes |
| 6.6 | **Docs.** CONTRACTS (C-RP-23 to C-RP-25); `docs/apps/notifications.md`; `CLAUDE.md` installed apps (if Q-RP-32 = A); the pre-deploy checklist; release notes; verification report. | `docs/review-pipeline/`, `docs/apps/`, `docs/07-deployment/`, `CLAUDE.md` |

**Who is notified** (C-RP-24). Every row below also requires that the target is in the recipient's reach, and leaves out the actor.

| Event | Kind | Recipients | Target |
|---|---|---|---|
| A thread is started | `note_created` | the assignee of the note's task; the artist of each linked version | the thread |
| A thread is started, a reply added, or a note edited, naming someone in `mention_ids` | `note_mention` | each person mentioned (on an edit, only the people added) | the thread |
| A reply is added | `note_reply` | the thread's author; everyone who replied earlier; the assignee of the thread's task | the thread |
| A thread changes status | `note_status` | the thread's author; the assignee of the thread's task | the thread |
| A task gets an assignee (or a new one) | `task_assigned` | the new assignee | the task |
| A task changes status (by hand or by the RP-3 roll-up) | `task_status` | the assignee | the task |
| A version changes status | `version_status` | the version's artist; the assignee of its task | the version |
| A review movie is ready or failed | `review_media_ready`, `review_media_failed` | the person who uploaded it | the version |

### Questions before RP-6 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-32 | Where does the inbox live? | A: a new app, `apps/notifications`. It holds the model, the routes and the handlers, and depends on production (events, selectors), which never imports it. B: inside `apps/production`. | **A**. Deliveries and publishing can notify later without making production the owner of everyone's inbox, and the direction of imports stays one way. It adds one entry to `INSTALLED_APPS`. |
| Q-RP-33 | Which events notify, and whom? | A: the table above. B: the table, plus review comments (`ReviewComment`) to the version's artist and the review's participants. | **A**. Review comments have their own visibility (`is_client_visible`, external participants), and Q-RP-4 kept them apart from notes. They can follow with their own rules. |
| Q-RP-34 | How is someone mentioned? | A: the composer sends `mention_ids` from a member picker. The server checks them and stores them as rows; the body is not parsed. B: the server parses `@…` in the body. | **A**. A username is an e-mail, so parsing text is unreliable. Explicit ids can be checked against who may read the thread. |
| Q-RP-35 | What does a row keep? | A: ids, the kind and status names. Labels are read from the live records when the inbox is fetched, so an edited note shows its new subject and a deleted one drops out. B: also an excerpt of the note body, copied at the time. | **A**. Copied bodies would outlive edits, deletes and a loss of access. This is the same concern that keeps notes out of the change log (still open). |
| Q-RP-36 | How does the browser learn of new rows? | A: it polls `unread-count/` every 60 seconds while the tab is visible, and again on focus. B: a websocket through Channels. | **A**. B needs a Redis channel layer in production, which is what RP-8 was deferred for (Q-RP-9). The count is one indexed query. |
| Q-RP-37 | Can a person mute kinds? | A: no preferences in RP-6. Every kind goes to people directly involved, and the actor is left out. B: a mute switch per kind, per user. | **A**. Preferences can follow once there is real use to tune against. |
| Q-RP-38 | How long are rows kept? | A: 90 days, read or not (`NOTIFICATIONS_RETENTION_DAYS`), purged daily. B: for ever. | **A**. The inbox is not a record; the change log and the records themselves are. |
| Q-RP-39 | What happens to the bell's session list of toasts? | A: the bell shows the server inbox only; toasts still appear and fade as now. B: the bell has two tabs, Inbox and This session. | **A**. The session list is lost on reload and repeats toasts the person already saw. Two lists under one bell would confuse. |
| Q-RP-40 | Is there a switch? | A: no, always on. It needs no worker, no volume and no outward channel. B: a deployment setting, off by default. | **A**. Unlike RP-5 there is nothing to deploy first. The dead `notification.*` settings and flags stay unread, and removing them is a settings-app change, not part of RP-6. |

Also decided in the plan, without a question:
- Rows are written in the request (or worker) that caused them, after commit. There is no Celery hop, so the web process needs no broker for this.
- A reach check happens when the row is written and again when it is read. Removing someone from a project, or narrowing them, hides their old rows at once.
- No new permission code, no role change, no trust-model change, so no ADR. Nobody learns of a record they cannot open.
- Notifications are not audited; the actions that cause them already are, where they are audited at all.

### Not in RP-6

- No e-mail, push, Slack or Teams (Q-RP-7 = A).
- No websocket (Q-RP-36 A).
- No preferences (Q-RP-37 A).
- No digests.
- No notifications for review comments, deliveries, publishing or scheduling.
- No watching or following a record: recipients come from the fields in the table.
- No removal of the dead `notification.*` settings and flags, or of `core/services/notifications.py`. That removal goes in its own commit if wanted, listed in the report.

### Tests (targeted, test database)

- **Inbox:**
  - own rows only (another user's id is a 404 on every route);
  - unread and kind filters;
  - `read-all` with `before` leaves a later row unread;
  - the count matches the list;
  - labels come from live records (edit a note's subject and the row shows it);
  - a deleted target drops out;
  - a recipient removed from the project, narrowed away from the target, or made inactive sees neither the row nor its count;
  - a bounded query count on the list (one per target type).
- **Recipients, one test per row of the table:**
  - who gets it, and that the actor does not;
  - a narrowed member who cannot read the thread or the version gets nothing;
  - a person matched twice gets one row;
  - a mention wins over the other kinds.
- **Assignment:** `TaskAssigned` from create, PATCH, `bulk-assign/`, bulk create and bulk update; nothing when the assignee does not change; nothing to someone who assigns themselves.
- **Review media:** `ReviewMediaFinished` on `ready` and on `failed` (with the code). Retry, the sweep's `timeout`, and a removed row behave as the contract says.
- **Fan-out failure:** a handler that raises leaves the note, status change or assignment saved and the response unchanged, and logs `notification_fanout_failed`.
- **Mentions:**
  - members who can read the thread are accepted;
  - a non-member, an inactive user, or a narrowed member who cannot read the thread is a 400;
  - an edit notifies only the added people;
  - `mentions` appears in the note shape.
- **Retention:** the purge deletes rows older than the setting and keeps the rest.
- **Unchanged:** the role matrix; `test_bootstrap.py` allows `production` nine migrations and `notifications` one.

Mutation checks. Each change below must make a test fail:
- notify the actor;
- skip the reach check when writing;
- skip it when reading;
- let a user read another's row;
- ignore `before`;
- drop one path's `TaskAssigned`;
- accept a mention of a non-member;
- notify every mention on an edit;
- let a fan-out error fail the request;
- purge rows younger than the limit.

### Gates

The same as RP-5 without the Docker checks: `ruff check`, `manage.py check`, `basedpyright` (no new findings in the files changed), `apps/notifications` and `apps/production` in full, and the backend suites of every app at the end. Frontend: `pnpm typecheck && pnpm test && pnpm build`, Biome at 0 errors, and the unreachable-code check.

### Release notes (draft)

- *Upgrading:* two additive migrations (`notifications` `0001`, `production` `0009`), and a new app in `INSTALLED_APPS`. Restart beat for the daily purge. There is no setting to turn on.
- *New:* an inbox behind the bell and on a Notifications page. People are told when a note concerns their work or mentions them, when someone replies in their thread, when they are given a task, when their task or version changes status, and when their review movie is ready or has failed.
