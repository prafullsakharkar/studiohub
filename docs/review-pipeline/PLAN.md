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

**Status:** planned 2026-11-13; approved the same day with every recommendation (Q-RP-32 to Q-RP-40 = A, [DECISIONS.md](DECISIONS.md#rp-6-answers)). Contracts C-RP-23 to C-RP-25. WP 6.1 to 6.6 built 2026-11-13 (`50324f4b`), merged into `develop` as `e5346727` and released in v4.7.0 ([rp-6-verification.md](rp-6-verification.md)); there is no single `assign/` route (the bulk one is `bulk-assign/`) and the model has no `thread_id` (CONTRACTS, "Details settled while building RP-6"). Branch `feature/rp-6-notifications`, off `develop` at `c0459cfc` (RP-1 to RP-5 merged, v4.6.0 released). It depends on RP-2 (the note events) and uses RP-3's and RP-5's events. Q-RP-7 = A: in-app only, so no e-mail and no new outward channel.

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

## RP-10 Loose ends of RP-5 and RP-6

**Status:** planned 2026-11-13; approved the same day with every recommendation (Q-RP-41 to Q-RP-45 = A, [DECISIONS.md](DECISIONS.md#rp-10-answers)). Contracts C-RP-26 and C-RP-27; WP 10.1 to 10.3 and 10.6 change no API. Branch `feature/rp-10-loose-ends`, off `develop` at `e5346727` (RP-1 to RP-6 merged and pushed). **Built** (WP 10.1 to 10.8) and committed (`ff1bc2fc`), merged into `develop` (`2cd9123d`) and released in v4.8.0: [rp-10-verification.md](rp-10-verification.md). WP 10.1 leaves out `EntityVersionsTab`, which shows no pictures (CONTRACTS, "Details settled while building RP-10"). The owner chose this over RP-8 (live review), media depth and notification depth. Phase numbers are not reused, so RP-7 to RP-9 stay as decided.

**Goal.** Close what the RP-2, RP-5 and RP-6 reports left open, without reversing a decision. Each item is small. None adds a model, a migration, a setting or a permission code (unless Q-RP-41 = B).

### Why (what is there today)

- **Cards on the Versions list and a shot's or asset's Versions tab lose their pictures after an hour.**
  - The signed review-media links expire at `links_expire_at` (3600 s).
  - The version page, the review viewer and compare refetch a minute before that (`reviewMediaRefetchInterval`).
  - The Versions list (`useVersionsListConfig`, a `DirectoryListPage` config with `staleTime` 60 s) and `EntityVersionsTab` (`EntityRecords`) have no refetch interval, so a card's generated thumbnail and filmstrip stop loading until the list is fetched again.
- **The player starts again from the first frame every hour.** `VersionMedia`, `ReviewViewer` (single and compare) and `VersionExtras` key `MediaPlayer` on the signed URL. A refreshed token is a new key, so the player is remounted.
- **Compare has no test for the review copy.** The compare tab and the viewer's compare mode use `versionPlayback`, as the player does, but no test shows that compare plays the proxy.
- **Artists cannot upload a review movie.** Upload, retry and remove (`upload_review_media`, `retry`, `destroy`) need `version.update`. The seeded `artist` role holds `version.view create` and `media.view create`, so an artist can create a version but not put a movie on it. Granting `version.update` would let them edit any version in reach.
- **The four notes views have untyped bodies in the OpenAPI schema.** They are `ProjectScopedAPIView`s, and spectacular cannot guess their serializers (RP-2 report). The frontend's types come from the captured sample, so nothing is broken; the schema just says less than it could.
- **Nothing ran against a live backend for RP-5 or RP-6.**
  - The live harness (`docs/sync/tools/live_backend.py`) runs Django in-process. No Celery worker runs, so an uploaded movie stays `queued`.
  - There is no live vitest file for the bell, the inbox, mentions or review movies.
- **Notes are not in the change log, and the follow-up is undecided** (RP-2 report, section 0 item 1). Tracking them would copy subjects and bodies into change-log rows, which narrowed members can read with `audit.view`.

### Work packages

| WP | Change | Files |
|---|---|---|
| 10.1 | **Version lists keep their links fresh.** `usePaginatedList` and `DirectoryListConfig` take an optional `refetchInterval(rows)`, also used by the board mode. The Versions config and `EntityVersionsTab` pass `reviewMediaRefetchInterval`, so the list is refetched while a job runs and a minute before the first link expires. Frontend only. | `frontend/src/shared/data/usePaginatedList.ts`, `frontend/src/modules/directory/{DirectoryListPage,types}.ts(x)`, `frontend/src/modules/production/review/{versions,EntityRecords}.tsx` |
| 10.2 | **A refreshed link does not restart the player** (Q-RP-44). The players are keyed by the review-media row's id, not the URL. When only the token changes, `MediaPlayer` swaps the source, seeks back to the frame it was on and keeps playing if it was playing. Frontend only. | `frontend/src/shared/components/media/MediaPlayer.tsx`, `frontend/src/modules/production/review/{VersionMedia,ReviewViewer,VersionExtras}.tsx` |
| 10.3 | **Compare plays the review copy, under test.** Tests for the compare tab and the viewer's compare mode: each side plays its proxy, with its thumbnail as the poster and the probe's rate; a side without a ready movie keeps `video_url`. Tests only, unless they find a bug. | `frontend/src/modules/production/review/__tests__/` |
| 10.4 | **Artists upload review movies to their own versions** (Q-RP-41). Recommended rule: upload, retry and remove are allowed to holders of `version.update`, and to the version's artist when they hold `version.create`. The three routes then ask for `version.update` or `version.create`, and the service checks the version (holder of `version.update`, or its artist) before acting. The frontend shows the panel's actions on the same rule. C-RP-19 is amended. | `backend/apps/production/{api/viewsets/version.py,api/viewsets/review_media.py,services/review_media.py,permissions/}`, `frontend/src/modules/production/review/ReviewMoviePanel.tsx` |
| 10.5 | **The notes views are typed in the schema** (Q-RP-45). `extend_schema` names the request and response serializers of the four notes views. No behaviour changes. The schema and `openapi.ts` are regenerated. | `backend/apps/production/api/views/project_notes.py`, `frontend/src/core/api/generated/*` |
| 10.6 | **Live runs** (Q-RP-43). <ul><li>The live harness gets an opt-in switch (`SYNC_LIVE_MEDIA=1`): review media on, and a thread that processes queued rows by calling the worker's function directly with the host's ffmpeg. There is no Celery worker; the harness only.</li><li>New live vitest files: notifications (one user's note, mention and assignment reach another's bell and inbox; read and read-all) and review movies (an upload reaches `ready` and plays the proxy; an artist uploads to their own version, under Q-RP-41 = A).</li><li>Run the role smoke once.</li></ul> | `docs/sync/tools/live_backend.py`, `frontend/src/test/live/{notifications,reviewMedia}.live.test.tsx` |
| 10.7 | **Notes and the change log** (Q-RP-42): record the decision. Recommended: notes stay out of the change log. Docs only, under A. | `docs/review-pipeline/{DECISIONS,CONTRACTS}.md` |
| 10.8 | Docs: CONTRACTS ("Details settled while building RP-10"), this status, the pre-deploy checklist (only if 10.4 changes who may upload), `rp-10-verification.md`. | `docs/review-pipeline/`, `docs/07-deployment/pre-deploy-checklist.md` |

### Questions before RP-10 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-41 | Who may upload, retry and remove a review movie? | A: holders of `version.update` (as now), plus the version's artist when they hold `version.create`. B: a new code, `version.upload_review_media`, seeded for the artist role and every role that holds `version.update` (an `init_platform` run). C: unchanged. | **A**. It matches how artists work in ShotGrid and ftrack (they put movies on their own versions) without letting them touch anyone else's. No new code, no seeding, no deploy step. |
| Q-RP-42 | Do notes go in the change log? | A: no. Notes keep their own fields (author, status, addressed by and at), and RP-6 notifies the people involved. B: yes, without the subject and body (ids, links, status and task only). C: yes, in full, once change-log readers need whole-project access for note rows. | **A**. B logs that something changed but not what, which helps little. C changes who may read the change log, which is an `apps/audit` decision outside this programme. |
| Q-RP-43 | How is review media run live? | A: the live harness processes queued rows itself, in-process, with the host's ffmpeg. B: a compose stack with the real `celery-media` worker. C: no live review-media run; notifications only. | **A**. It reuses the harness every live file uses, and it runs the same processing function and ffmpeg commands. The Celery routing to the `media` queue is already proven by a backend test and by CI's image build. |
| Q-RP-44 | What happens when a link is refreshed during playback? | A: the player keeps its place (keyed by the row's id; the source is swapped and the frame restored). B: longer links (raise `REVIEW_MEDIA_LINK_TTL_SECONDS`, for example to 8 hours) and no code change. | **A**. B weakens a security setting to hide a client bug, and still restarts the player once the longer link runs out. |
| Q-RP-45 | Type the notes views in the schema? | A: yes, `extend_schema` on the four views. B: no. | **A**. A documentation change that makes the generated types match the sample; no behaviour change. |

### Not in RP-10

- No live review (RP-8), image sequences, OCIO, burn-ins or object storage (ADR-0040, "Not decided here").
- No notification preferences, e-mail or push (Q-RP-7, Q-RP-36, Q-RP-37).
- No removal of the toast history in the toast store (eight test files read it), of the dead `notification.*` settings, or of `core/services/notifications.py`.
- No `AutomationRule` engine (Q-RP-5 = A).

### Tests (targeted, test database)

- **10.1:** the Versions list and the Versions tab refetch while a job runs and before the first link expires, and not otherwise.
- **10.2:** a refreshed link keeps the player's frame and its playing state; a different row (a replaced movie) starts again.
- **10.3:** compare and the viewer's compare play each side's proxy, poster and rate; a side without a ready movie keeps `video_url`.
- **10.4 (under A):**
  - the version's artist with `version.create` may upload, retry and remove;
  - another artist on the same project may not (403);
  - an artist who is no longer the version's artist may not;
  - holders of `version.update` keep every right;
  - the frontend shows the actions on the same rule.
  - The role matrix test is unchanged.
- **10.5:** the schema names the serializers of the four notes views, and the generated types only add.
- **10.6:** the live files pass against the harness; the role smoke passes.

Mutation checks. Each change below must make a test fail:
- no refetch on the Versions list;
- the player keyed by URL again;
- the source swapped without restoring the frame;
- compare playing `video_url` over the proxy;
- an artist allowed on another's version;
- the artist rule without `version.create`;
- the frontend showing upload to every artist.

### Gates

The same as RP-6: `ruff check`, `manage.py check`, `basedpyright` (no new findings in the files changed), `apps/production` in full. Frontend: `pnpm typecheck && pnpm test && pnpm build`, Biome at 0 errors, and the unreachable-code check. The live files and the role smoke (10.6) run once, one run at a time.

### Release notes (draft)

- *Upgrading:* no migration, no setting, nothing to run.
- *Changed:* artists can put a review movie on their own versions, retry it and remove it. Cards on version lists keep their pictures, and a playing movie keeps its place when its link is renewed.

## RP-11 Notification depth (reviews and preferences)

**Status:** planned 2026-11-14; approved the same day with every recommendation (Q-RP-46 to Q-RP-50 = A, [DECISIONS.md](DECISIONS.md#rp-11-answers)). Contracts C-RP-28 to C-RP-30. Branch `feature/rp-11-notification-depth`, off `develop` at `81db4182` (v4.8.0). The owner chose this over media depth and a cleanup phase. **Built** (WP 11.1 to 11.7) and committed as `a7443900`, merged into `develop` (`0fe2dbf5`) and `main` (`32da0d68`), released in v4.9.0 ([rp-11-verification.md](rp-11-verification.md)). Three points turned out differently: one migration instead of two, a new live file instead of extending `notifications.live.test.tsx`, and "the artist of a version" includes the assignee of its task (CONTRACTS, "Details settled while building RP-11").

**Goal.** People are told about the review work that concerns them: a decision on a review their version is in, being asked for a verdict, a participant's answer, a comment on their version. And each person can mute the kinds they do not want. Still in-app only (Q-RP-7 = A), still polled (Q-RP-36 = A).

### Why (what is there today)

- **A review's decision tells nobody.** `ReviewService.change_status` and `record_verdict` move the review through `StatusService`, which publishes `StatusChanged` with `entity_type = "Review"`. The RP-6 handler (`notifications/events/handlers.py`, `StatusChangedHandler`) only acts on `Task` and `Version`, so it returns. A decision on a review does not move its versions' statuses (no cascade), so `version_status` does not fire either. An artist learns that their version was approved or sent back only by opening the review.
- **Being asked for a verdict tells nobody.** `ReviewService.add_participant` creates a `ReviewParticipant`, and nothing is published.
- **A participant's verdict tells nobody.** `record_participant_verdict` saves the verdict and logs a `ReviewActivity` row. The lead reviewer (`Review.lead_reviewer`) and the review's creator see it only on the review.
- **Review comments were left out on purpose** (Q-RP-33 = A): they have their own visibility (`is_client_visible`, external participants), and Q-RP-4 kept them apart from notes. `ReviewService.add_comment` publishes nothing.
- **`is_client_visible` is stored and never enforced.** The flag is written by `POST reviews/{id}/comments/` (`api/viewsets/review.py:177`) and returned in each comment. But the review shape serves every comment to anyone who can read the review (`api/serializers/review/base.py:37`), and that includes a client member who takes part in the review (`selectors/external_scope.py`, "Client: the reviews they take part in"). So a comment the studio marked not client-visible is shown to the client. This is a confidentiality gap that predates the programme. The app's composer never sends the flag (every comment written in the app is client-visible), so internal comments come only through the API and the old-list import today. It matters here because a comment notification must not reach someone the comment is hidden from.
- **Who acts on a review.** Commenting, adding participants and recording a participant's verdict need `review.update`; a decision needs `review.approve`. The seeded artist role holds `review.view` only, so artists read reviews and are the ones told; leads, supervisors and production act (and a client member acts only if their role grants `review.update`).
- **No preferences** (Q-RP-37 = A, "once there is real use to tune against"). Every kind goes to everyone directly involved.
- **The inbox knows three target types** (`note`, `task`, `version`). Reach and labels come from `production/selectors/notification_sources.py`, one subquery per type. A review is not one of them.

### Work packages

| WP | Change | Files |
|---|---|---|
| 11.1 | **Client-visible comments are enforced** (Q-RP-47). A client member of the review's project is served only comments with `is_client_visible = true`, and the replies of those threads, in every answer that holds the review's comments (`GET reviews/`, `GET reviews/{id}/`, and the actions that answer the whole review, such as resolve). A comment a client member writes is always client-visible. Internal members and vendors see every comment as now. | `backend/apps/production/api/serializers/review/{base,parts}.py`, `selectors/review.py`, `services/review.py`, `selectors/external_scope.py` (docstring) |
| 11.2 | **Review events** (Q-RP-46, Q-RP-50). New events in `apps/production/events/reviews.py`, published after commit:<ul><li>`ReviewParticipantAdded` (`review_id`, `project_id`, `user_id`, `actor_id`);</li><li>`ReviewParticipantVerdict` (`review_id`, `project_id`, `participant_user_id`, `verdict`, `actor_id`);</li><li>`ReviewCommentAdded` (`review_id`, `project_id`, `comment_id`, `parent_id`, `version_id`, `is_client_visible`, `author_id`).</li></ul>The review's decision reuses `StatusChanged` (`entity_type = "Review"`). Ids and status names only, never the comment's text. | `backend/apps/production/events/reviews.py`, `services/review.py` |
| 11.3 | **Review notifications** (C-RP-28). Target type `review` (reach: `review.view` and the narrowing of `GET reviews/{id}/`, which already covers external members; label: the review's code and title). New kinds `review_decision`, `review_invited`, `review_verdict`, `review_comment`. Recipients follow the table below, with the RP-6 rules: in reach when written and when read, never the actor, one row per person per event. A comment that is not client-visible is never told to a client member. Migration `notifications` `0002` (the new choices). | `backend/apps/notifications/{constants,events/handlers,migrations}.py`, `backend/apps/production/selectors/notification_sources.py` |
| 11.4 | **Preferences** (Q-RP-48, Q-RP-49, C-RP-30). `NotificationPreference(user, muted_kinds)`, one row per person, created on first save. `GET notifications/preferences/` and `PUT notifications/preferences/` (own row only; any signed-in user; an unknown kind or a kind that cannot be muted is a 400). The fan-out skips a recipient who muted the kind. Migration `notifications` `0003`. | `backend/apps/notifications/{models,services,api}/`, migrations |
| 11.5 | **Frontend.** The API module and row keys from captured responses. The bell and the Notifications page describe and open the new kinds (a review row opens `/reviews/{id}`). The Notifications page gets a Preferences panel: one switch per kind that can be muted. The review comment composer gets an "Internal (hidden from the client)" switch for studio members (Q-RP-47 = A); a client member never sees it, and the server forces their comments client-visible anyway. | `frontend/src/api/notifications/`, `frontend/src/modules/notifications/`, `frontend/src/modules/reviews/` |
| 11.6 | **Live run.** Extend `notifications.live.test.tsx`: a supervisor decides a review that holds the artist's version, the artist is asked for a verdict and answers, a comment on their version; preferences mute a kind and the next event writes nothing. A client member does not see an internal comment and is not told about it. | `frontend/src/test/live/notifications.live.test.tsx`, `docs/sync/tools/live_backend.py` (seed a client member, if needed) |
| 11.7 | **Docs.** CONTRACTS (C-RP-28 onwards), `docs/apps/notifications.md`, the pre-deploy checklist (two migrations; clients stop seeing internal comments), DECISIONS, release notes, `rp-11-verification.md`. | `docs/review-pipeline/`, `docs/apps/`, `docs/07-deployment/` |

**Who is notified** (proposed, Q-RP-46 = A). Every row also requires that the review is in the recipient's reach, leaves out the actor, and skips a recipient who muted the kind (WP 11.4).

| Event | Kind | Recipients | Target |
|---|---|---|---|
| A review reaches a decision: `Approved`, `Rejected`, `Changes Requested` or `Retake` (by a status change or the supervisor's verdict) | `review_decision` | the artists of the review's live versions; the review's participants | the review |
| Someone is added as a participant | `review_invited` | that person | the review |
| A participant records a verdict | `review_verdict` | the review's lead reviewer; the review's creator | the review |
| A comment is added on a version of the review | `review_comment` | the artist of that version | the review |
| A reply is added to a comment thread | `review_comment` | the thread's author; everyone who replied earlier; the artist of the thread's version | the review |

A comment with `is_client_visible = false` reaches no client member, whatever the table says. A row keeps the decision or verdict (`data.to_status`, `data.verdict`) and the version's id (`data.version_id`), never the comment's text (Q-RP-35 = A).

### Questions before RP-11 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-46 | Which review events notify, and whom? | A: the table above (decision, invitation, participant verdict, comments on your version and replies in your thread). B: A without comments. C: A, and every comment also goes to every participant. | **A**. These are the review moments a person is directly part of, as in ShotGrid and ftrack. C makes a busy review flood everyone on it, before there is any way to tune it except muting the whole kind. |
| Q-RP-47 | What about `is_client_visible`, which is stored and never enforced? | A: enforce it in RP-11 (WP 11.1): a client member is served only client-visible comments and their replies, is never told about the others, and what they write is always client-visible. The composer gets an "Internal" switch for studio members. B: only keep notifications from leaking (no client member is told about an internal comment), and record the read-side gap as a known limit. C: hide internal comments from vendors too. | **A**. Today a client reads comments the studio marked internal. That is the flag's whole purpose, and the notification rule would be pointless while the review itself shows them. Vendors are production partners who already see their own tasks' reviews; C is a separate decision about vendors. It changes no trust model (it narrows a client to what the flag already said), so no ADR, and the pre-deploy checklist says so. |
| Q-RP-48 | Which kinds can a person mute? | A: every kind except the ones addressed to them by name: `note_mention` and `review_invited`. B: every kind. C: no preferences yet (as RP-6). | **A**. Muting is for noise; being mentioned or asked for a verdict is a request for action, and a muted request is missed work. |
| Q-RP-49 | What does muting do? | A: a muted kind is not written for that person; unmuting does not bring back what was skipped. B: rows are written and hidden from the bell and the list while muted. | **A**. Simpler and cheaper: no hidden rows to count, page or purge. Nothing is lost that matters, because the records themselves stay. |
| Q-RP-50 | Which review status changes notify? | A: the decisions only (`Approved`, `Rejected`, `Changes Requested`, `Retake`), from a status change or a verdict. B: every status change (`Submitted`, `In Review`, `Closed` too). | **A**. The decisions are what an artist acts on; `Submitted` and `In Review` are the reviewer's own bookkeeping. |

Also decided in the plan, without a question:
- No e-mail, push or websocket (Q-RP-7, Q-RP-36). No digests. No following or watching a record.
- No mentions in review comments: review comments keep their own records (Q-RP-4); mentions stay on notes.
- No notifications for deliveries, publishing or scheduling.
- No removal of the dead `notification.*` settings and flags, or of `core/services/notifications.py` (the cleanup phase the owner did not choose).
- No new permission code, and no ADR: nobody learns of a record they cannot open, and WP 11.1 narrows clients to what the flag already promised.

### Not in RP-11

- Preferences per project, per record, or by channel (there is one channel).
- A comment's text in the notification (Q-RP-35 = A).
- Notifying a vendor or a client of anything outside the reviews they reach.

### Tests (targeted, test database)

- **11.1:**
  - a client member gets only client-visible comments and their replies, in the list, the detail and the actions that answer the whole review;
  - a client member's own comment is stored client-visible even when they send `false`;
  - internal members and vendors see every comment as before;
  - the captured review sample is recaptured.
- **11.2, 11.3:**
  - each event of the table writes its kind for exactly its recipients;
  - never the actor;
  - one row per person;
  - a person out of the review's reach gets nothing;
  - a client member gets no row for an internal comment;
  - a non-decision status change writes nothing (under Q-RP-50 = A);
  - the inbox lists and labels review rows, and drops them when the review leaves the reader's reach;
  - a failed fan-out never fails the review action.
- **11.4:**
  - a muted kind writes no row for that person and still writes for the others;
  - `note_mention` and `review_invited` cannot be muted (400);
  - an unknown kind is a 400;
  - a person reads and writes only their own preferences.
- **11.5:** the new kinds' text and links; the Preferences panel saves and shows the server's answer; the composer offers "Internal" to studio members only, and sends the flag.
- **11.6:** the live file passes against the harness.

Mutation checks. Each change below must make a test fail:
- clients served every comment again;
- a client's comment kept internal;
- the review handler ignoring decisions;
- a non-decision status notifying;
- the actor notified;
- an internal comment told to a client member;
- a muted kind still written;
- a mention mutable;
- the frontend opening a review row anywhere but the review.

### Gates

The same as RP-10: `ruff check`, `manage.py check`, `makemigrations --check`, `basedpyright` (no new findings in the files changed), `apps/production` and `apps/notifications` in full. Frontend: `pnpm typecheck && pnpm test && pnpm build`, Biome at 0 errors, and the unreachable-code check. The live file runs once.

### Release notes (draft)

- *Upgrading:* two migrations in `notifications` (new choices, and the preferences table), both additive. No setting, nothing to grant.
- *Changed:* people are told when a review with their version reaches a decision, when they are asked for a verdict, when a participant answers their review, and when someone comments on their version. Each person can mute the kinds they do not want, except mentions and verdict requests.
- *Security:* client members no longer see review comments the studio marked internal.

## RP-12 Media depth (image sequences and burn-ins)

**Status:** planned 2026-11-16; approved the same day with every recommendation (Q-RP-51 to Q-RP-56 = A, [DECISIONS.md](DECISIONS.md#rp-12-answers)). Contracts C-RP-31 to C-RP-33. Branch `feature/rp-12-media-depth`, off `develop` at `0fe2dbf5` (RP-11 merged; `main` is `32da0d68`). The owner chose this over a cleanup phase, notifications beyond reviews, and object storage. It amends ADR-0040 ("Not decided here": sequences and burn-ins). **Built** (WP 12.1 to 12.8) and committed as `f2b84225`, merged into `develop` (`292b5060`, with follow-ups to `31d7e42e`), released in v4.9.0 ([rp-12-verification.md](rp-12-verification.md)). The 2,000-frame cap was measured as planned: it fits the 25-minute budget on a 4-CPU media worker (about 16 minutes for 2K EXR) and not on 2 CPUs (about 36), so the default stays and the pre-deploy checklist says when to lower it.

**Goal.** A version's review copy can be made from a rendered image sequence (EXR or DPX, as VFX work is mostly delivered), not only from a movie. A project can choose to burn the shot, the version and the frame number into its review copies. The worker, the signed links, the player and the reach rules of RP-5 and RP-10 stay as they are.

### Why (what is there today)

- **Only one file per upload** (ADR-0040, decision 1). `POST versions/{id}/review-media/` takes one movie or still; EXR and DPX are refused by extension (`transcode/detect.py`, `ALLOWED_EXTENSIONS`). An artist with a render has to make a movie elsewhere first.
- **The worker can already read sequences.** A spike in the `worker` image (`studiohub-worker:rp5`, ffmpeg 7.1.5) turned ten EXR frames (`shot.1001.exr` to `shot.1010.exr`) and ten DPX frames into an H.264 proxy with RP-5's lockdown: `-protocol_whitelist file -format_whitelist image2 -codec_whitelist exr -f image2 -start_number 1001 -framerate 24 -i file:<folder>/frame.%04d.exr`. ffprobe counted the ten frames. The first bytes tell the formats apart: EXR `76 2f 31 01`, DPX `SDPX` or `XPDS`.
- **ffmpeg stops silently at a gap.** With `1001, 1002, 1004` on disk it read two frames and ended without an error. The server has to check that a sequence is whole before ffmpeg sees it.
- **Burn-ins can be drawn safely.** The image has `drawtext` (libfreetype) and the DejaVu fonts (`/usr/share/fonts/truetype/dejavu/`). Text from the database put in a file and drawn with `textfile=<file>:expansion=none` came out literally, including `%{pts}`, quotes, `:` and `\`, so it cannot reach the filter graph. The frame counter is a template we write (`%{eif\:n+1001\:d}`) and showed the source's frame number (1004 on the fourth frame).
- **EXR is scene-linear; DPX is often log.** Shown as stored, an EXR looks dark and flat. ffmpeg's EXR decoder has `apply_trc` (for example `iec61966_2_1`, sRGB), and the image has `lut3d`; it has no OpenColorIO.
- **The player already counts from `Version.start_frame`** (`ReviewViewer.tsx`, `VersionMedia.tsx`; `start_frame ?? 1`). Comments and annotations keep the frame number shown when they were written.
- **Limits that matter for sequences.** Django refuses more than 100 files in one request (`DATA_UPLOAD_MAX_NUMBER_FILES`, a global setting). nginx's upload location takes 2,100 MB. A job has one 25-minute budget (27 and 30 minutes in Celery). A 2K EXR frame is a few to tens of MB, so a 100-frame shot can pass 2 GiB.

### Work packages

| WP | Change | Files |
|---|---|---|
| 12.1 | **Sequence upload** (Q-RP-51, Q-RP-52). A row of kind `sequence` and a new status `uploading`. The client opens the upload, sends the frames in parts, then completes it; the service checks every frame's name and first bytes, stores it under our own name (`source/frame.<number>.<ext>`), and on completion checks the sequence is whole and queues the job. Abandoned uploads expire (the sweep). New settings for the frame cap and the sequence's total size. Migration `production` `0010` (choices, the in-flight constraint covers `uploading`, the frame fields). | `backend/apps/production/{models/review_media.py,services/review_media.py,transcode/detect.py,transcode/sequence.py (new),api/viewsets/{version,review_media}.py,api/serializers/review_media.py}`, `backend/config/{env.py,settings/components/storage.py}`, migration |
| 12.2 | **Sequence processing** (Q-RP-53). The worker reads the stored frames through `image2` with the forced codec (`-codec_whitelist`), the colour rule below, and the same proxy, thumbnail and filmstrip as a movie. The probe gains `first_frame`, `last_frame` and `colour`. Frames are deleted when the copy is ready (Q-RP-56). | `transcode/ffmpeg.py`, `services/review_media.py` |
| 12.3 | **Burn-ins** (Q-RP-54). `Project.review_burn_ins` (off by default). When on, the worker draws the fixed layout on movie and sequence proxies (not stills), from a text file with `expansion=none`, in a fixed font (`REVIEW_MEDIA_BURN_IN_FONT`). Project create, update and detail carry the field. Migration in `0010`. | `models/project.py`, `api/serializers/project*.py`, `transcode/ffmpeg.py`, `services/review_media.py` |
| 12.4 | **Frame range** (Q-RP-55). When a sequence becomes ready and the version has neither `start_frame` nor `end_frame`, they are set from the frames. | `services/review_media.py` |
| 12.5 | **Image and deploy.** The `worker` stage installs `fonts-dejavu-core` explicitly (it is only there as a dependency today). nginx gains the part route (same body limit as uploads). `.env.example` entries. ADR-0040 amended. | `infrastructure/docker/django/Dockerfile`, `infrastructure/docker/nginx/default.conf`, `.env.example`, `backend/.env.example`, `docs/adr/ADR-0040-review-media-processing.md` |
| 12.6 | **Frontend.** The review movie panel offers "Upload a sequence": pick a folder or several files; the frames are checked in the browser first (one name, one extension, no gap; the same rules, for a quick message), sent in parts with progress, then completed. A ready sequence shows its range, frame count and colour rule. The project form gains "Burn-ins on review copies" (for those who may edit the project). Typed API and row keys from captured responses; schema regenerated. | `frontend/src/api/production/`, `frontend/src/modules/production/review/ReviewMoviePanel.tsx`, the project form, `frontend/src/core/api/generated/*` |
| 12.7 | **Capture and live.** The review-media capture tool gains the sequence flow (made with the host's ffmpeg: a few small EXR frames) and a burn-in project. `reviewMedia.live.test.tsx` uploads a sequence in two parts and plays it; the frame shown counts from the sequence's first frame. | `docs/sync/tools/test_capture_review_media.py`, `docs/sync/samples/production/`, `docs/sync/tools/live_backend.py`, `frontend/src/test/live/reviewMedia.live.test.tsx` |
| 12.8 | **Docs.** CONTRACTS (C-RP-31 onwards), `docs/apps/` for production media, the pre-deploy checklist (migration, new settings, font, nginx route), DECISIONS, release notes, `rp-12-verification.md`. | `docs/review-pipeline/`, `docs/apps/`, `docs/07-deployment/` |

**The sequence upload** (proposed, Q-RP-51 = A). Every route needs what an upload needs today (C-RP-26: `version.update`, or the version's artist with `version.create`), on a version the caller reads (else 404), with review media on (else 409).

| Route | Does |
|---|---|
| `POST versions/{id}/review-media/sequence/` | Opens an upload: `{"name": "shot_010_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1100}`. Checks the range against the frame cap. A 409 when the version already has one in flight (as now). Answers 201 with the row (`status: uploading`). |
| `POST review-media/{id}/frames/` | Multipart, up to 50 files. Each file's name must be `<name>.<frame>.<extension>` (`.`, `_` or `-` before the number) inside the declared range, not sent before; its first bytes must match the extension. Stored as it arrives. Answers 200 with how many frames are in and which are still missing (the first 50). A bad file refuses the whole part (400 naming it); the frames already in stay. |
| `POST review-media/{id}/complete/` | Every frame of the range must be in (else 400 with the missing ones). Queues the job: 202 with the row (`status: queued`). |
| `DELETE review-media/{id}/` | Also cancels an upload in progress (today it removes a ready copy). |

### Questions before RP-12 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-51 | How does a sequence reach the server? | A: an upload in parts (the table above): open, send up to 50 frames per request, complete. B: one zip of the frames through today's route; the server unpacks it. C: all frames in one request, raising Django's 100-file limit for every route. | **A**. No request is larger than a part, so it fits nginx's and the network's limits, shows progress, and a failure loses one part. There is no archive to unpack (zip bombs, names inside the archive) and no global limit raised. The cost is three routes and an `uploading` state that expires. |
| Q-RP-52 | What is a valid sequence? | A: EXR or DPX frames (also TIFF, PNG or JPEG frames), one name and one extension, frame numbers 0 to 99,999,999, no gap, at most 2,000 frames (`REVIEW_MEDIA_MAX_FRAMES`) and 20 GiB (`REVIEW_MEDIA_SEQUENCE_MAX_BYTES`). B: A, but a gap is filled by holding the frame before it, and the missing numbers are shown. | **A**. A review copy with held frames looks finished when it is not. Refusing a gap is honest and simple, and the message names the missing frames; B can follow. 2,000 frames is 83 seconds at 24 fps; WP 12.2 measures a 2K job of that length against the 25-minute budget, and the cap is lowered if it does not fit. |
| Q-RP-53 | How is colour handled? | A: a fixed display rule with what ffmpeg has: EXR from linear to sRGB (`apply_trc`), DPX and the rest as stored; the panel names the rule, and says the copy is not for colour approval. B: A, plus a 3D LUT (`.cube`) per project, uploaded by a production admin and applied to sequences. C: OpenColorIO with a studio config, through OpenImageIO in the worker (a new decoder, a config to manage). | **A**. Real colour management is a studio decision with its own config files, and C is a phase of its own (and a second decoder to secure). A gives a usable picture for checking shape, motion and continuity. B or C can follow without changing what is stored. |
| Q-RP-54 | Burn-ins: what, and when? | A: a fixed layout, switched per project (`review_burn_ins`, off by default): top left the project code and the shot or asset code; top right the version code; bottom left the date it was made; bottom right the frame number (the sequence's own, or `start_frame` + n for a movie). Movies and sequences, not stills. Existing copies are not remade. B: A, always on. C: a template per project (which fields, where). D: none: the player already shows the frame and the version. | **A**. Burn-ins matter when a copy is shown outside the player (a screen share, a recording, a saved link), and studios differ on whether they want them, so a switch. A fixed layout covers the usual fields; C is a design tool of its own. |
| Q-RP-55 | Does a sequence set the version's frame range? | A: only when the version has neither `start_frame` nor `end_frame`; otherwise nothing changes. B: always. C: never. | **A**. The player counts from `start_frame`, so a sequence from 1001 should show 1001. Overwriting a range someone typed (B) would shift the frame numbers of comments already written. |
| Q-RP-56 | What happens to the frames once the copy is ready? | A: they are deleted (a failed job keeps them for a retry; an upload that expires loses them). B: they are kept until the copy is superseded or removed, as a movie's source is. | **A**. A sequence is many times a movie's size, the frames are already on the studio's storage, and nothing serves them or remakes the copy from them. |

Also decided in the plan, without a question:
- Frame names are never used as paths: a frame is stored as `source/frame.<number, 8 digits>.<extension>` from the number parsed out of its name.
- Every frame is checked by its first bytes as a movie is now; the worker forces the decoder (`-codec_whitelist exr`, `dpx`, ...) as well as the demuxer, and keeps `-protocol_whitelist file`.
- Text from the database reaches ffmpeg only through a file read with `expansion=none`; the only expanded text is the frame counter, which the code writes.
- The 25-minute job budget stays; a longer job fails with `timeout` as now.
- No new permission code: the upload rights are C-RP-26's.
- One migration (`production` `0010`): the new kind and status, the constraint, the frame fields, and `Project.review_burn_ins`.

### Not in RP-12

- OpenColorIO, per-project LUTs, HDR, audio-only files (Q-RP-53; ADR-0040).
- Reading frames from studio storage by path (the worker mounts only the media volume).
- Remaking existing copies when the burn-in switch changes.
- Slates (a title card before the first frame).
- Object storage for review media.

### Tests (targeted, test database)

- **12.1:**
  - open, parts and complete answer as the table says; the rights and the 404/409 of today's upload;
  - a frame outside the range, sent twice, with another name or extension, or whose first bytes do not match is a 400 and the part is refused;
  - complete with a gap is a 400 naming the missing frames;
  - the frame cap and the total size are enforced; a part over 50 files is a 400;
  - an upload left `uploading` expires in the sweep and loses its folder; a cancel removes it;
  - stored names are ours (a name with `../` or a path is refused or ignored, never used).
- **12.2:** the command builders (image2, the forced codec, `apply_trc` for EXR only, the start number); a whole sequence becomes `ready` with the proxy, thumbnail and filmstrip and a probe with the range; a frame that will not decode fails as `transcode_failed`; the frames are deleted when ready and kept when failed.
- **12.3:** the burn-in file holds the codes; hostile text (`%{pts}`, `'`, `:`, `\`, a newline) is drawn literally (a real ffmpeg run, checked in the probe and by the command's arguments); off by default; stills get none.
- **12.4:** the range is set only when both are empty.
- **12.6:** the panel's checks (gap, mixed names), the parts sent in order with progress, the completed state; the project switch.
- **12.7:** the capture passes; the live file passes against the harness.

Mutation checks. Each change below must make a test fail:
- a gap accepted;
- a frame's own name used as its path;
- a frame not sniffed;
- the codec not forced;
- `apply_trc` applied to DPX, or dropped for EXR;
- burn-in text drawn with expansion on;
- burn-ins drawn when the switch is off;
- the range overwritten when one is set;
- the frames kept when ready, or deleted when failed;
- an expired upload not swept.

### Gates

The same as RP-11: `ruff check`, `manage.py check`, `makemigrations --check`, `basedpyright` (no new findings in the files changed), `apps/production` in full. Frontend: `pnpm typecheck && pnpm test && pnpm build`, Biome at 0 errors, and the unreachable-code check. The worker image is built and a sequence is run through it once. The live file runs once.

### Release notes (draft)

- *Upgrading:* one migration in `production`. New settings `REVIEW_MEDIA_MAX_FRAMES`, `REVIEW_MEDIA_SEQUENCE_MAX_BYTES` and `REVIEW_MEDIA_BURN_IN_FONT` (defaults work with the `worker` image). Rebuild the `worker` image and reload nginx (a new upload route).
- *Changed:* a review copy can be made from an EXR or DPX image sequence, uploaded in parts from a folder. A project can burn the shot, the version and the frame number into its review copies.

## RP-13 Notifications beyond reviews (deliveries, publishing, milestones)

**Status:** planned 2026-11-16; answered the same day (Q-RP-57 to Q-RP-62 = A, [DECISIONS.md](DECISIONS.md#rp-13-answers)); contracts C-RP-34 to C-RP-36; built, report in [rp-13-verification.md](rp-13-verification.md); committed `88a24c4b`, merged into `develop` (`1a87076f`) and `main`, released in v4.10.0. Branch `feature/rp-13-notifications-beyond-reviews`, off `develop` at `987d6839` (v4.9.0). The owner chose this over colour (LUT/OCIO), media depth part 2, object storage and the cleanup phase.

**Goal.** The inbox that RP-6 and RP-11 built for notes, tasks, versions and reviews also tells people about the records that production waits on: a delivery moving (signed off, sent, answered by the client, reopened), a publish job finishing or failing, a published file being revoked, and a milestone coming due. Still in-app only (Q-RP-7 = A), still polled, with the same rules: only people in reach, never the actor, one row per person per event, muted kinds skipped (C-RP-24, C-RP-30).

### Why (what is there today)

- **Deliveries publish no events.** `deliveries/services/transitions.move` is the only writer of `DeliveryPackage.status` and records each move in `DeliveryStatusChange` (with its actor), but tells nobody. Signing off, sending and recording the client's answer (`services/package.py`: `sign_off`, `send`, `record_client_answer`) set `signed_off_by`, `sent_by` and `client_answered_by`. The record also has `created_by`. Whoever is waiting on a delivery has to open it to find out.
- **A revoked file changes deliveries silently.** `PublishedFileRevoked` is the one event of these apps. Deliveries subscribes (`RevokedFileHandler`): unsent deliveries holding the file's version lose their QC, and a signed-off one is moved back to Prepared. Nobody is told that their delivery reopened.
- **Publish jobs end silently.** `publishing/services/workflow.py` moves a job (`PublishItem`) through Pending, Validating, Validated, Exporting, then Exported or Failed (or Cancelled), with an audit entry each time. Its creator (`created_by`) and the version's artist see the result only on the page.
- **Milestones have due dates and nobody is reminded.** `scheduling.Milestone` has `due_date`, a status (Pending, In Progress, Completed), `completed_by`, `created_by`, and for a delivery milestone a `delivery_package_id` (no foreign key: scheduling does not import deliveries). Nothing runs on a due date.
- **The inbox knows four target types**, all production records, with reach and labels from `production/selectors/notification_sources.py`. `Notification.project` is required, which every record here has (a delivery, a job, a published file and a milestone each belong to a project). Leave requests do not (Q-RP-62).
- **Reading these records** needs `delivery.view`, `publishing.view` and `schedule.view` respectively, plus each app's own narrowing (CR-46, CR-53: artists lose `delivery.view`; external members see only what their membership reaches). The dependency rules allow `notifications` to read the three apps; none of them may import `notifications` (`apps/core/tests/test_dependency_direction.py`).

### Work packages

| WP | Change | Files |
|---|---|---|
| 13.1 | **Events** (Q-RP-57, Q-RP-59). Published after commit, each in its app's `events/`:<ul><li>`DeliveryStatusChanged` (`delivery_id`, `project_id`, `from_status`, `to_status`, `actor_id`, `system`), from `transitions.move`;</li><li>`DeliveryClientAnswered` (`delivery_id`, `project_id`, `client_status`, `actor_id`), from `record_client_answer`;</li><li>`PublishJobFinished` (`job_id`, `project_id`, `version_id`, `status`, `actor_id`) for Exported and Failed;</li><li>`MilestoneCompleted` (`milestone_id`, `project_id`, `actor_id`).</li></ul>`PublishedFileRevoked` is reused. | `backend/apps/{deliveries,publishing,scheduling}/events/`, their services |
| 13.2 | **Reach and labels.** A `selectors/notification_sources.py` in each of deliveries, publishing and scheduling, in the shape of production's: the people involved in a record, a `readable_query(request)` that answers what the record's own `GET` would (permission code and narrowing), and a label (`code`, `name`, `record`). The notifications app looks a target type up in one registry instead of production's four-way switch. | `backend/apps/{deliveries,publishing,scheduling}/selectors/notification_sources.py` (new), `backend/apps/notifications/{sources.py (new),services/fanout.py,selectors/,api/serializers.py}` |
| 13.3 | **Kinds and handlers** (the table below). Target types `delivery`, `publish_job`, `published_file`, `milestone`. The milestone reminders (Q-RP-61) are a beat task, `notifications.milestone_reminders` (hourly as built, C-RP-36), that writes each reminder once (a row of the same kind, target and stage is never written twice). Migration `notifications` `0003` (choices only). The new kinds can be muted. | `backend/apps/notifications/{constants.py,events/,tasks/,migrations/}`, `backend/config/settings/components/celery.py` |
| 13.4 | **Frontend.** The typed API and row keys from captured responses. The bell and the Notifications page describe and open the new kinds: a delivery row opens `/deliveries/{id}`, a job `/publishing/{id}`, a file `/publishing/files/{id}`, a milestone the project's milestones. "What to tell me" gains the new kinds (labels only; the server lists them). | `frontend/src/api/notifications/`, `frontend/src/modules/notifications/` |
| 13.5 | **Capture and live.** A capture tool and sample for the whole flow. A live file: the producer creates a delivery, a supervisor signs it off and sends it, the producer is told each time; a publish job fails and its creator is told; a revoked file reopens a signed-off delivery and its people are told. | `docs/sync/tools/`, `docs/sync/samples/notifications/`, `frontend/src/test/live/` |
| 13.6 | **Docs.** CONTRACTS (C-RP-34 onwards), `docs/apps/notifications.md`, the pre-deploy checklist (one migration, a new beat entry), DECISIONS, release notes, `rp-13-verification.md`. | `docs/review-pipeline/`, `docs/apps/`, `docs/07-deployment/` |

**Who is notified** (proposed, Q-RP-57 to Q-RP-61 = A). Every row also requires that the record is in the recipient's reach, leaves out the actor, and skips a recipient who muted the kind.

| Event | Kind | Recipients | Target |
|---|---|---|---|
| A delivery reaches Signed Off, Submitted, Approved, Rejected, Complete or Cancelled, or leaves Signed Off or a sent status (reopened by a revoked file, or corrected with the override) | `delivery_status` | the delivery's creator; whoever signed it off; whoever sent it | the delivery |
| The client's answer is recorded | `delivery_client_answer` | the delivery's creator; whoever signed it off; whoever sent it | the delivery |
| A publish job ends Exported or Failed | `publish_finished` | the job's creator; the version's artist and the assignee of its task | the job |
| A published file is revoked | `published_file_revoked` | the file's creator; the creators of the files built from it (RP-4 dependencies); the people of each unsent delivery it changed (creator, signer) | the file |
| A milestone is due tomorrow, or was due yesterday and is not completed | `milestone_due` | the milestone's creator; for a delivery milestone, the delivery's creator | the milestone |
| A milestone is completed by someone else | `milestone_completed` | the milestone's creator | the milestone |

A row keeps the statuses (`data.from_status`, `data.to_status`, `data.client_status`, `data.status`) and, for a reminder, `data.stage` (`due` or `overdue`) and `data.due_date`; never a reason, a comment or a file path. A move made by the system (a revoked file reopening a delivery) has no actor, so nobody is left out as the actor.

### Questions before RP-13 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-57 | Which records notify? | A: deliveries, publish jobs, published files and milestones (the table). B: A without milestones (no timed reminders). C: deliveries only. | **A**. These are the records production waits on. Milestones are the only timed kind and need a beat task, but a due date nobody is reminded of is the gap people notice. |
| Q-RP-58 | Who is told about a delivery? | A: the people on the record: its creator, whoever signed it off, whoever sent it. B: A, plus the project's members who hold the right for the next step (Prepared: `delivery.approve`; Signed Off: `delivery.send`). C: everyone on the project with `delivery.view`. | **A**. Those are the people waiting on it, and they are named on the record. B is a request-for-action feature: with flat roles it tells every holder of the code on the project, which on a large show is many people for every delivery. It can follow as "following a record" if A proves too narrow. |
| Q-RP-59 | Which delivery moves notify? | A: arriving at Signed Off, Submitted, Approved, Rejected, Complete or Cancelled, and leaving Signed Off or a sent status. B: every move, including Draft, Validating and Prepared. | **A**. The working states change often while a delivery is assembled; the others are the steps someone waits for, and leaving them (a reopen, a correction) is the surprise worth telling. |
| Q-RP-60 | Publishing: what notifies? | A: a job ending Exported or Failed, and a revoked file (the table). B: jobs only. C: A, plus every file registered on a version (to its artist). | **A**. A failed export and a revoked file are what someone has to act on; a revoked file also reopens deliveries silently today. Registering a file is the artist's own action, so C mostly tells people what they just did. |
| Q-RP-61 | Milestones: when and whom? | A: a daily task tells the creator (and a delivery milestone's delivery creator) once the day before it is due and once the day after if it is not completed; completion tells the creator when someone else completes it. B: reminders for delivery milestones only. C: no milestone notifications. | **A**. Two reminders per milestone at most, to people named on it. Dates are the studio's calendar dates (the default work calendar's time zone). |
| Q-RP-62 | Leave requests? | A: not in RP-13. B: include them: a request tells the people who may approve leave, and the answer tells the requester. | **A**. A leave request belongs to no project, so it needs `Notification.project` to become optional, a reach rule for people who approve leave across the studio, and a page to open. That is a phase of its own. |

Also decided in the plan, without a question:
- No e-mail, push or websocket (Q-RP-7, Q-RP-36). No digests. No following or watching a record.
- No new permission code, and no ADR: nobody learns of a record they cannot open, and every recipient is named on the record.
- Reach is decided by each app's own selector (the record's `GET`), so CR-46 and CR-53's narrowing hold: an artist without `delivery.view` is told nothing about deliveries.
- Events are published after commit; a notification never fails the action (handlers log `notification_fanout_failed` and swallow the error).
- One migration (`notifications` `0003`): the new kinds and target types, no data step.

### Not in RP-13

- Leave requests and anything else without a project (Q-RP-62).
- Requests for action to everyone who holds a right (Q-RP-58 B), and following a record.
- QC results, bookings and calendar events.
- A reason, comment or path in the notification.
- The cleanup of the dead `notification.*` settings and `core/services/notifications.py`.

### Tests (targeted, test database)

- **13.1:** each event is published once, after commit, with its payload; a rolled-back action publishes nothing; the revocation's system move publishes with `system: true`.
- **13.2:** reach per target type matches the record's `GET` (permission code, CR-46/CR-53 narrowing, external members); labels; a deleted record answers nothing.
- **13.3:** every row of the table, including the actor left out, people counted once, muted kinds skipped, reach checked when written and when read; moves that do not notify (working states); the reminder written once per stage, not for a completed milestone, and on the right dates; the beat entry.
- **13.4:** rows, links and preference labels for each new kind.
- **13.5:** the capture passes; the live file passes against the harness.

Mutation checks. Each change below must make a test fail:
- a working-state move notifies;
- the actor is told;
- reach not checked for one new target type;
- an artist without `delivery.view` is told about a delivery;
- the system move leaves out a person as its actor;
- a reminder written twice, or for a completed milestone;
- a muted new kind still written;
- the revocation forgets the people of a reopened delivery.

### Gates

The same as RP-12: `ruff check`, `manage.py check`, `makemigrations --check`, `basedpyright` (no new findings in the files changed), targeted `apps/notifications`, `apps/deliveries`, `apps/publishing`, `apps/scheduling` and `apps/core/tests` (dependency direction, admin registry, bootstrap). Frontend: `pnpm typecheck && pnpm test && pnpm build`, Biome at 0 errors, and the unreachable-code check. The live file runs once.

### Release notes (draft)

- *Upgrading:* one migration in `notifications`. Beat gains `notifications.milestone_reminders` (hourly). No new setting, no new permission code.
- *Changed:* the inbox also tells people when a delivery they work on is signed off, sent, answered by the client or reopened; when a publish job they started ends or fails; when a file they built on is revoked; and when a milestone they set is due or overdue. Each kind can be muted.

## RP-14 Review copies: remaking and slates

**Status:** planned 2026-11-17; answered the same day (Q-RP-63 to Q-RP-67 = A, [DECISIONS.md](DECISIONS.md#rp-14-answers)): no slates, WP 14.3 drops. Contracts C-RP-37 and C-RP-38. Built, report in [rp-14-verification.md](rp-14-verification.md); committed `10fedb13` (cleanup `6bffaefa`), merged into `develop` (`3a6a80cc`) and `main`, released in v4.11.0. Branch `feature/rp-14-media-slates`, off `develop` at `f7f99139` (v4.10.0).

**Goal.** A project's review copies match its burn-in switch: someone who turns burn-ins on or off can have the copies already made remade, without uploading again and without the current copy disappearing while the new one is made. Whether review copies also get a slate is decided here (Q-RP-63). The dead notification code left from before RP-6 is removed.

### Why (what is there today)

- **The burn-in switch only affects new copies.** C-RP-33: "Copies already made are not remade when the switch changes." Each ready row records whether it has burn-ins (`probe.burn_ins`), so the copies that differ from the switch are known, but nothing can remake them. A retry (C-RP-20) takes only a `failed` row.
- **A movie's upload is kept, a sequence's frames are not.** A movie or still keeps `source_path` after it is ready. A sequence's frames are deleted when its copy is ready (Q-RP-56, C-RP-32), so a sequence copy cannot be remade; only a new upload can change it.
- **A new copy replaces the old one only when it is ready.** `_finish` marks the version's older `ready`/`failed` rows `superseded` and deletes their folders, including the kept upload. One row per version may be in flight (`review_media_busy`, 409). So a remake cannot simply be a new row pointing at the old upload: the old folder would be deleted under it.
- **The burn-in's date is the day the copy is made** (C-RP-33, bottom left, UTC). A remake made today would date old work today.
- **Each ready copy notifies its uploader** (`review_media_ready`, RP-6). A bulk remake would send one per version.
- **Slates.** A slate is a title card (project, shot, version, artist, date, frame range) before the first frame. The viewer turns playback time into a frame number from the copy's rate and the version's first frame (`ReviewViewer.tsx`), and every comment and drawing stores that frame number. A slate inside the movie shifts every frame by its length unless the probe says how long it is and the viewer skips it. Review copies are watched only inside the app (no download route), where the version's header already shows everything a slate says. ShotGrid and ftrack do not add slates to review media either: the studio's pipeline renders them before upload (RP-9, a separate repository).
- **Dead code.** `apps/core/services/notifications.py` (`NotificationService`, 28 lines, a stub from before RP-6) is used only by its own re-export and one test that checks it has `notify`. `SettingKeys.NOTIFICATION_EMAIL_ENABLED`, `NOTIFICATION_SMS_ENABLED` and `NOTIFICATION_PUSH_ENABLED` (`apps/settings/constants/settings.py`) are read nowhere, seeded nowhere, and not used by the frontend (Q-RP-7: in-app only).

### Work packages

| WP | Change | Files |
|---|---|---|
| 14.1 | **Remake one copy** (Q-RP-64, Q-RP-66, Q-RP-67). `POST review-media/{id}/remake/` on a `ready` movie or still whose upload is kept: a new row for the same version, `queued`, whose upload is a hard link to the old row's (same volume; a copy if linking fails), so superseding the old row later cannot delete it. The old row stays `ready` and shown until the new one is ready; if the new one fails, the old one stays (as for any upload). The new row remembers the row it remakes (`remakes`), keeps the original's burn-in date, and makes no `review_media_ready` notification. The right is C-RP-26's (manage the version's review copy). 409 `review_media_busy` while the version has a row in flight; 400 for a sequence (its frames are gone), a row that is not `ready`, or an upload that is missing. Audit `review_media_remake`. Migration production `0011`: `ReviewMedia.remakes` (nullable, self), `ReviewMedia.burn_in_date` (nullable date). | `production/services/review_media.py`, `api/viewsets/review_media.py`, `models/review_media.py` |
| 14.2 | **Remake a project's copies that differ** (Q-RP-65). `POST projects/{id}/review-media/remake/` (the rights that write a project, like the switch): every version's current `ready` movie or still whose `probe.burn_ins` differs from `review_burn_ins` and whose version has nothing in flight is remade as in 14.1. Answers `{"queued", "skipped_busy", "skipped_sequence"}`. The project read shows `review_copies_out_of_date` (the number that differ), so the frontend can offer it. | `production/services/review_media.py`, `api/viewsets/project*.py`, `selectors/` |
| 14.3 | **Slates** (Q-RP-63). Option A: none (this WP drops). Option B: a slate image (`slate.jpg`) made beside each movie copy, same text rules as burn-ins (text files, `expansion=none`), shown in the review panel and before playback; the movie and its frame numbers are unchanged. Option C: a one-second slate at the start of the movie copy, `probe.slate_frames`, and the viewer skips it in its frame arithmetic, timeline and filmstrip. | `production/transcode/ffmpeg.py`, `services/review_media.py`, frontend review viewer |
| 14.4 | **Frontend.** The review movie panel: a "Remake" action on a ready movie or still copy whose burn-ins differ from the project's switch (or always, for those with the right), the queued state while the old copy stays shown, the sentence for a sequence ("upload the frames again"). The project's review settings: after the switch changes, "N review copies were made with the other setting. Remake them" when `review_copies_out_of_date` > 0. Typed API from captured responses. | `frontend/src/api/production/`, `modules/production/review/`, project settings |
| 14.5 | **Cleanup** (no question). Remove `core/services/notifications.py`, its re-export and test assertion, and the three `notification.*` setting keys, in their own commit, listed in the report. | `apps/core/services/`, `apps/core/tests/test_selectors_services.py`, `apps/settings/constants/settings.py` |
| 14.6 | **Capture, live and docs.** Capture tool and sample (remake one, remake the project's, the busy and sequence refusals); a live file (switch on, the project offers the remake, the copy is remade and the old one stays until then); CONTRACTS, DECISIONS, the pre-deploy checklist (one migration), `docs/apps/` media notes, release notes, `rp-14-verification.md`. | `docs/sync/`, `docs/review-pipeline/`, `docs/07-deployment/` |

### Questions before RP-14 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-63 | Slates on review copies? | A: no slate in RP-14; slates are rendered by the studio's pipeline before upload. B: a slate image beside each movie copy, shown in the panel and before playback; the movie is unchanged. C: a one-second slate inside the movie copy, with the viewer skipping it. | **A**. I suggested slates before reading the viewer: inside the movie (C) a slate shifts every frame number that comments and drawings store, so the viewer, timeline and filmstrip all have to skip it, for a card that repeats the version's header. Copies are watched only in the app, and ShotGrid and ftrack leave slates to the pipeline too. B is cheap and safe but adds little. If clients later get review copies as files (a download or a delivery), C becomes worth it then. |
| Q-RP-64 | What can be remade? | A: movies and stills, whose uploads are kept; a sequence says to upload its frames again. B: A, and from now on a sequence's frames are kept while its copy is current, so it can be remade too (Q-RP-56 changes; up to 20 GiB per sequence stays on the media volume). | **A**. Keeping frames reverses Q-RP-56 for a storage cost that every sequence pays, to serve a switch that rarely changes. |
| Q-RP-65 | How is a remake started? | A: a "Remake" action on one copy, and "Remake the copies that differ" for the project after the switch changes. B: automatically: changing the switch queues every differing copy. C: one copy at a time only. | **A**. Turning the switch should not silently queue hours of media work (B); doing it per version (C) is tedious on a project of hundreds. The project action queues them on the media queue, which runs one job at a time per worker as today. |
| Q-RP-66 | The burn-in date of a remade copy? | A: the original copy's date, so a remake does not date old work today. B: the day it is remade (C-RP-33 as written). | **A**. The date tells a reviewer when the work was put up for review. Copies made before RP-14 have no stored date; their remake uses the day the original row was created. |
| Q-RP-67 | Does a remade copy notify? | A: no; the copy is the same work, and a project remake would send one per version. B: yes, `review_media_ready` to whoever asked for the remake. C: as today, to the original uploader. | **A**. A failed remake still tells whoever asked for it (`review_media_failed`), since the old copy stays and they may want to know. |

Also decided in the plan, without a question:
- A remake never removes what is shown: the old copy stays `ready` until the new one is ready, then it is superseded as any older copy is.
- No new permission code: one copy uses C-RP-26's right; the project action uses the rights that write a project (the same as the switch).
- No new setting and no ADR (ADR-0040 is unchanged: same pipeline, same font, same text rules).
- The cleanup (14.5) is its own commit.

### Not in RP-14

- OpenColorIO, per-project LUTs and HDR (their own planning, ADR-0040).
- Reading frames from studio storage by path (the worker's access to studio storage is a security decision).
- Object storage for review media.
- Downloading a review copy, which is what would make a slate inside the movie worth its cost.
- More notification sources (QC results, bookings, calendar events, leave requests).

### Tests (targeted, test database)

- **14.1:** remake answers 202 with a queued row; the old row stays ready and shown until the new one is ready, then is superseded and its folder deleted while the new upload survives (hard link); a failed remake leaves the old copy ready; 409 while busy; 400 for a sequence, a non-ready row, a missing upload; 404 out of reach, 403 without the right; the burn-in date is the original's; no `review_media_ready` row, a `review_media_failed` row to the asker; the audit entry.
- **14.2:** only differing current copies are remade; busy versions and sequences are counted, not remade; `review_copies_out_of_date` before and after; the project write rights.
- **14.5:** `manage.py check` and the core tests after the removal.

### Mutation checks

The old row superseded on queue instead of on ready; the upload moved instead of linked; the busy check skipped; a sequence accepted; the burn-in date taken from today; the ready notification sent; the project remake including copies that already match.

### Gates

ruff check, `manage.py check`, `makemigrations --check`, basedpyright with no new errors in changed files, targeted backend tests (production, notifications, core); frontend typecheck, Biome, tests, build, unreachable check; capture and live runs.

## RP-15 Colour management for review copies

**Status:** planned 2026-11-17; answered the same day, every recommendation taken (Q-RP-68 to Q-RP-72 = A, [DECISIONS.md](DECISIONS.md#rp-15-answers)). Built on `feature/rp-15-colour-management`, off `develop` at `73570a2e` (v4.11.0), committed `ae0c6dde`, merged into `develop` and `main`, released in v4.12.0 ([rp-15-verification.md](rp-15-verification.md)). Contracts C-RP-39 and C-RP-40; [ADR-0041](../adr/ADR-0041-review-colour-management.md). Corrections made while building: the upload field is `color_space` (as the project's), not `colour_space`; the transform goes into `probe.ocio` and `probe.colour` gains the value `ocio`, rather than `probe.colour` becoming an object; the host has a LUT-capable ffmpeg, so no wrapper is needed (below).

**Goal.** A review copy made from scene-linear or log frames looks the way the studio's pipeline shows them: the frames go through the studio's OpenColorIO view (by default ACES 2.0, SDR, for an sRGB screen) instead of today's fixed linear-to-sRGB curve. Each project chooses its view; each copy records how it was made; copies made with other colour settings can be remade (RP-14).

### Why (what is there today)

- **One fixed rule.** EXR frames are decoded with ffmpeg's `apply_trc iec61966_2_1`: linear light straight to the sRGB curve, no tone mapping and no gamut conversion (`transcode/sequence.py`, `transcode/ffmpeg.py`). DPX, TIFF, PNG, JPEG and every movie are taken as already display-ready. Anything above 1.0 clips, and ACEScg primaries are shown as if they were Rec.709.
- **Measured against the ACES view** (spike below): mid grey 0.18 shows as 118 of 255 today, 89 through the ACES 2.0 SDR view; across a test image the mean difference is 40 of 255 and the largest 227. A supervisor reviewing comp in the app sees a brighter, clipped, more saturated picture than in Nuke or RV.
- **The colour fields exist but nothing reads them.** `Project.color_space` and `Version.color_space` are free text, both default `"ACEScg"`, and are shown on the project page and dashboard only. A version's value is `ACEScg` whatever was uploaded, H.264 movies included, so it cannot drive processing.
- **The worker's ffmpeg has no OpenColorIO filter.** The worker image is `python:3.14-slim` (Debian trixie) with Debian's ffmpeg 7.1.5. FFmpeg's `ocio` filter arrived in 8.1; Debian has 9.0 only in testing.
- **OpenColorIO is available as a wheel.** `opencolorio` 2.6.0 (2026-10-01, BSD-3-Clause, about 6 MB) has manylinux wheels for CPython 3.13 and 3.14 on x86_64 and aarch64. It carries the ASWF built-in configs, `ocio://studio-config-v5.0.0_aces-v2.1_ocio-v2.6` (ACES 2.0; what `ocio://default` resolves to) back to the ACES 1.3 ones, so no config file has to be shipped.

**Spike** (throwaway container: the worker's base image, Debian's ffmpeg 7.1.5, `opencolorio` 2.6.0). OpenColorIO bakes the whole transform (input space → display/view) into a cineSpace LUT with an ACEScct shaper (65³ cube, 4096-point shaper, 0.4 s, 7.6 MB); ffmpeg applies it with `lut3d=…:interp=tetrahedral` on the float EXR picture, before scaling and burn-ins. Compared with OpenColorIO's own processor on the same pixels:

| | Difference from OCIO, in 8-bit code values |
|---|---|
| Pixels of ordinary saturation (channel ratio under 8) | largest 1.75, mean 0.15: below what the 8-bit 4:2:0 copy can show |
| All pixels of a random HDR test image (values to 32, ratios to 7,000) | mean 0.47; 2.3% of pixels differ by more than 4, the worst by 27, all very bright, near-pure greens where ACES 2.0's gamut compression bends hardest (a 129³ cube halves it) |
| Today's rule | mean 40, largest 227 |

The encode of 48 frames at 2048×1080 took 1.68 s with the LUT against 1.46 s today (+15%). *Corrected while building:* the host's `/usr/bin/ffmpeg` is Debian's 7.1.5 and reads the LUT; only the shell's `ffmpeg` alias points to an old 2.8 build that cannot. The capture and live runs use `/usr/bin/ffmpeg`; no wrapper is needed.

### Work packages

| WP | Change | Files |
|---|---|---|
| 15.1 | **The config** (Q-RP-68). Setting `REVIEW_MEDIA_OCIO_CONFIG`: default the pinned built-in `ocio://studio-config-v5.0.0_aces-v2.1_ocio-v2.6`; a studio sets it to its own `config.ocio` (a path the worker and web can read) or another built-in. Dependency `opencolorio==2.6.0`. A small `transcode/colour.py`: load the config once, resolve a colour space by name or alias, list the sRGB display's views and the looks, bake a LUT for (config, input, view, look) into `REVIEW_MEDIA_DIR/luts/<hash>.csp` once and reuse it. `manage.py check` warns when the config cannot be loaded. | `config/settings/components/storage.py`, `config/settings/base.py`, `production/transcode/colour.py`, `pyproject.toml`, `uv.lock` |
| 15.2 | **Project colour settings** (Q-RP-69, Q-RP-70, Q-RP-71). The project's `color_space` is the input space of its scene-referred frames (EXR); new `review_view` (a view of the sRGB display; blank = the config's default view) and `review_look` (blank = none). A project write naming a colour space, view or look must name one in the config (400 otherwise). Values already stored are not changed; one the config does not know means "no transform" for new copies and is flagged. `GET review-media/colour/` (any signed-in user who can see a project) lists the config's name, colour spaces (with aliases and encoding), the views and looks, for the form. Migration production `0012`. | `production/models/project.py`, `api/serializers/project/*`, `validators/`, `api/viewsets/review_media.py` |
| 15.3 | **Processing.** EXR frames go through the baked LUT for the project's input, view and look instead of `apply_trc`; the same filter feeds the copy, its thumbnail, filmstrip and still. Burn-ins are drawn after the LUT, so their text is not coloured. An upload may name its own colour space (`colour_space` on a movie upload or a sequence create), which applies the transform to that movie or those frames (a log ProRes, a DPX in ADX10); otherwise movies and non-EXR frames stay as today. `probe.colour` records `{config, input, display, view, look}`, or `null` when nothing was transformed. A copy whose input space the config cannot resolve falls back to today's rule and records `colour: null` with `colour_skipped` saying why. | `production/transcode/{ffmpeg,sequence,colour}.py`, `services/review_media.py` |
| 15.4 | **Copies made with other settings** (Q-RP-72). C-RP-38's count includes ready copies whose `probe.colour` differs from what the project would use now; the project remake (C-RP-37/38) remakes those movies with the project's settings and the burn-in date kept. A sequence copy still cannot be remade. | `production/selectors/review_media.py`, `services/review_media.py` |
| 15.5 | **Frontend.** The project's settings: Colour space, Review view and Look as selects from `review-media/colour/` (a stored unknown value shown with "not in the studio's colour config"). The review movie panel shows how the copy was made ("ACEScg → sRGB, ACES 2.0 SDR 100 nits"). An optional colour space on a movie upload and a sequence upload. The review-copies notice says "made with other colour or burn-in settings". Typed API from captured responses. | `frontend/src/api/production/`, `modules/production/review/`, project settings |
| 15.6 | **Capture, live, docs.** Capture tool and sample on real ffmpeg with OpenColorIO (an EXR sequence through the ACES view, a log movie with a named colour space, the refusals, the colour list); the capture and live runs use the host's `/usr/bin/ffmpeg` (7.1.5, as the worker's); *the wrapper planned here was not needed*. A live file (the project picks a view, an EXR sequence comes out tone-mapped, the panel says how). ADR-0041 (colour management for review copies: OpenColorIO as a Python dependency, a baked LUT applied by the distribution's ffmpeg, the config setting; to be replaced by ffmpeg's own `ocio` filter once the worker's ffmpeg has it). CONTRACTS, DECISIONS, the pre-deploy checklist (one migration, a new dependency, the setting), `rp-15-verification.md`. | `docs/sync/`, `docs/adr/`, `docs/review-pipeline/`, `docs/07-deployment/` |

### Questions before RP-15 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-68 | Which OpenColorIO config? | A: a setting, `REVIEW_MEDIA_OCIO_CONFIG`, defaulting to the pinned built-in ACES 2.0 studio config; a studio on ACES 1.3 or with its own config sets it. B: the built-in config only. C: the studio's own config, required (no default). | **A**. Works out of the box, and a studio whose artists work in ACES 1.3 (`ocio://studio-config-v2.2.0_aces-v1.3_ocio-v2.4`) or in its own config gets the same picture in review as in Nuke by changing one setting. The default is pinned by name, so upgrading the package never changes how copies look. |
| Q-RP-69 | Where does a copy's input colour space come from? | A: EXR frames use the project's `color_space` (default ACEScg); movies and other frames stay display-ready as today unless the upload names a colour space. B: the version's `color_space`. C: a default per format on the project (EXR, DPX, movie). | **A**. The version's field says ACEScg on every version, H.264 movies included, so B would tone-map movies that are already graded for display. C is more settings for a case the upload's own colour space covers. |
| Q-RP-70 | What does a project choose for display? | A: a view and an optional look for the sRGB display (the browser shows sRGB). B: the display too (Display P3, Rec.2100 PQ for HDR). | **A**. The browser draws the copy as sRGB on almost every screen, and the copy is 8-bit H.264; P3 and HDR copies would need a different encode and a viewer that tags and shows them, which is its own phase. |
| Q-RP-71 | Check `color_space` on project writes? | A: from now on a project write must name a colour space the config knows (by name or alias); stored values are left, and an unknown one means "no transform" and is flagged. B: keep it free text; an unknown value means "no transform". | **A**. The field starts to matter, and a typo ("ACEScg 1.3", the dashboard's fallback text) would silently turn colour management off. The frontend gets a select, so the check costs users nothing. This changes the project write contract (one more 400), recorded in CONTRACTS. |
| Q-RP-72 | Copies made with other colour settings? | A: counted in the project's review-copies notice and remade like the burn-in ones (RP-14); sequences cannot be remade, as today. B: A, and from now on an EXR or DPX sequence's frames are kept while its copy is current, so changing a project's view can remake them too (Q-RP-56 and Q-RP-64 change; up to 20 GiB per sequence). C: not counted; new settings apply to new copies only. | **A**. EXR sequences are where colour matters most, so B is tempting, but it pays the storage for every sequence to serve a setting a project sets once at the start. A view chosen before review starts makes A enough; if projects change views mid-show, B can follow. |

Also decided in the plan, without a question:
- **A baked LUT, not ffmpeg's `ocio` filter.** The worker's Debian ffmpeg 7.1 has no `ocio` filter, and building ffmpeg ourselves would put a compiler and a hand-built media stack into the worker image. The bake is OpenColorIO's own (`Baker`), measured above; ADR-0041 records that the filter replaces it once Debian stable's ffmpeg has it.
- **Burn-ins stay readable**: they are drawn after the colour transform.
- **No new permission code.** The colour settings use the rights that write a project (as the burn-in switch); the colour list follows reading a project.
- **The web image gets the package too** (it checks names on project writes and lists the options); it bakes nothing.
- **The dependency change runs Containers and the dependency audit** on the merge (`pyproject.toml`, `uv.lock`); the release waits for both to be green.

### Not in RP-15

- Display P3 and HDR copies (Q-RP-70 B); 10-bit copies.
- Per-shot or per-version grades (CDL), and looks per sequence.
- Keeping a sequence's frames to remake it (Q-RP-72 B).
- Reading frames from studio storage by path; object storage; downloading a review copy; slates.

### Tests (targeted, test database)

- **15.1:** the pinned config loads; a missing config path makes `check` warn and processing fall back to today's rule; a LUT is baked once per settings and reused; names and aliases resolve.
- **15.2:** project writes accept known colour spaces, views and looks and refuse unknown ones (400 with the field); stored unknown values survive other writes; the colour list's shape and who may read it; the migration.
- **15.3:** an EXR sequence's ffmpeg command uses the LUT and no `apply_trc`; burn-ins come after it; thumbnail, filmstrip and still use it; a movie without a named colour space is untouched; a movie with one uses it; `probe.colour` and `colour_skipped`; real ffmpeg (skipped without a LUT-capable ffmpeg): mid grey lands within 2 code values of OpenColorIO's own answer.
- **15.4:** copies whose colour differs are counted and remade; matching ones are not; sequences are counted as such.

### Mutation checks

`apply_trc` kept alongside the LUT; burn-ins drawn before the LUT; the thumbnail made without the LUT; a movie transformed without a named colour space; the version's `color_space` used instead of the project's; an unknown colour space accepted on a project write; the LUT rebaked on every job; `probe.colour` left out; copies with matching colour counted as differing.

### Gates

ruff check, `manage.py check`, `makemigrations --check`, basedpyright with no new errors in changed files, targeted backend tests (production, notifications, core); frontend typecheck, Biome, tests, build, unreachable check; capture and live runs; after the merge, CI, Containers and Dependency audit green.

## RP-16 Sequence copies after a settings change

**Status:** planned 2026-11-17; answered the same day (Q-RP-73 to Q-RP-76 = A, [DECISIONS.md](DECISIONS.md#rp-16-answers)); committed `eb5cb64d`, merged into `develop` and `main`, released in v4.13.0 ([rp-16-verification.md](rp-16-verification.md)). Branch `feature/rp-16-sequence-copies`, off `develop` at `f446bd6b` (v4.12.1).

**Goal.** When a project's colour or burn-in settings change, its image-sequence copies can be dealt with. Recent ones are remade like movies, old ones are listed so their frames can be uploaded again, and copies a project is happy with can be kept as they are, so the project's notice can go.

### Why (what is there today)

- **A sequence's frames go when its copy is ready** (Q-RP-56, C-RP-32): `ReviewMediaService._finish` deletes `source/` and clears `source_path`. So `_remake` refuses every sequence (`"sequence"`), and the project remake only counts them (`skipped_sequence`).
- **v4.12.0 makes every project with EXR sequences show a notice nobody can act on.** Copies made before RP-15 went through the fixed curve, so they differ from the ACES view (C-RP-40, "copies made before RP-15"). The notice says "N image sequences were made with other settings" but does not say which, and only re-uploading clears it. The same happens whenever a project changes its view, look or burn-ins later.
- **The notice is a count.** `GET projects/{id}/review-copies/` answers four numbers (C-RP-38, C-RP-40), with no list of versions.
- **The pieces for keeping frames exist.**
  - A remake hard-links its upload (RP-14), and the same works per frame (up to `REVIEW_MEDIA_MAX_FRAMES`, 2,000).
  - The ten-minute sweep (`production.sweep_review_media`, general worker) already finds rows to tidy and hands folders to the media worker's `production.discard_review_media`.
  - A sequence is at most `REVIEW_MEDIA_SEQUENCE_MAX_BYTES` (20 GiB).

### Work packages

| WP | Change | Files |
|---|---|---|
| 16.1 | **Keep a sequence's frames for a while** (Q-RP-73, Q-RP-74). Setting `REVIEW_MEDIA_SEQUENCE_KEEP_DAYS` (default 14; 0 = today's rule). New `ReviewMedia.frames_until` (datetime, null), set when a sequence's copy is first ready. The frames stay in `source/` until then, superseding the copy still deletes its folder, and the sweep clears `source_path` and discards `<folder>/source` once the time has passed. Migration production `0013`. | `models/review_media.py`, `services/review_media.py`, `config/env.py`, `components/storage.py`, `base.py` |
| 16.2 | **Remake a sequence while its frames are kept.** `_remake` accepts a ready sequence whose frames are still there: the new row hard-links each frame into its own `source/` (a copy where linking fails), keeps `color_space`, the burn-in date and `frames_until` (Q-RP-74), and is processed as a sequence. The project remake remakes those too; `skipped_sequence` then counts only sequences whose frames are gone. The 400 sentence for a sequence becomes "The frames of this sequence are no longer kept. Upload the frames again." | `services/review_media.py`, `api/viewsets/review_media.py` |
| 16.3 | **Which copies differ** (Q-RP-75). The read gains `differing`: up to 100 rows, each `{review_media_id, kind, version {id, code}, record_code, remakable, frames_until, why}`, where `why` is `burn_ins` and/or `colour`, oldest first. Plus `differing_more` (how many were left out). | `selectors/review_media.py`, `api/serializers/review_media.py` |
| 16.4 | **Keep copies as they are** (Q-RP-76). `POST projects/{id}/review-copies/keep/` (`project.update`) takes `{"review_media_ids": [...]}`: differing copies that cannot be remade. It stores on each row what it was kept against (`kept_for`: the burn-in switch and the colour transform it would be made with now). A kept copy stops counting until the project's settings change again. Audit `review_media_kept`. Migration in `0013`. | `models/review_media.py`, `services/review_media.py`, `selectors/review_media.py`, `api/viewsets/review_media.py` |
| 16.5 | **Frontend.** The notice gains a list ("Show which"), each row linking to the version's page: its code, why it differs, and "frames kept until <date>" or "upload the frames again". There is a **Keep as they are** button for whoever may change the project. Remake on a ready sequence copy while its frames are kept, with "Frames kept until <date>" on the panel. Typed API from captured responses. | `frontend/src/api/production/`, `modules/production/review/` |
| 16.6 | **Capture, live, docs.** Capture tool and sample on real ffmpeg (a kept sequence remade after a view change, an expired one listed, keep, the refusals). A live file. CONTRACTS (C-RP-41 to C-RP-43), DECISIONS, ADR-0040 amended (frames kept for a window), pre-deploy checklist (the migration, the setting, the disk it costs), `rp-16-verification.md`. | `docs/sync/`, `docs/review-pipeline/`, `docs/adr/`, `docs/07-deployment/` |

### Questions before RP-16 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-73 | How long are a sequence's frames kept once its copy is ready? | A: a setting, `REVIEW_MEDIA_SEQUENCE_KEEP_DAYS`, default 14 days; 0 keeps today's rule. B: for as long as the copy is current (Q-RP-72 B). C: not kept; RP-16 only lists and keeps copies as they are. | **A**. The settings of a show are usually corrected in its first weeks, and 14 days covers that. The disk is bounded by what is uploaded in 14 days rather than by every sequence ever uploaded (up to 20 GiB each). A studio short on disk sets 0 and still gets the list and "keep as they are". |
| Q-RP-74 | Does a remake keep the frames longer? | A: no, a remake keeps the original's `frames_until`, as it keeps the burn-in date (Q-RP-66). B: each remake starts a new window. | **A**. With B, remaking every two weeks would keep frames forever without anyone choosing that. |
| Q-RP-75 | How are the differing copies listed? | A: in the read itself (`differing`, the first 100, oldest first, and how many more). B: a separate paginated route. | **A**. One request for the notice. A project with more than 100 differing copies is told how many more there are; remaking or keeping the first ones brings the rest up. |
| Q-RP-76 | Can a project keep differing copies as they are? | A: yes, copies that cannot be remade (sequences whose frames are gone), by whoever may change the project; kept against the settings of the moment, so a later change counts them again. B: no; only re-uploading clears them. C: A, for movies too. | **A**. Without it, the notice v4.12.0 brings for old EXR sequences never goes unless every sequence is uploaded again. Movies can always be remade, so they need no "keep". |

Also decided in the plan, without a question:
- **No new permission code.** Reading the list follows `project.view`, as the counts do; keeping and remaking follow `project.update` (C-RP-38).
- **Existing copies' frames are already gone,** so the window applies only to sequences whose copy becomes ready after the upgrade. Old ones are listed and can be kept or uploaded again.
- **No notification** for frames reaching the end of their window.
- **Disk:** at most the sequences uploaded in `REVIEW_MEDIA_SEQUENCE_KEEP_DAYS` days, each up to `REVIEW_MEDIA_SEQUENCE_MAX_BYTES`. The checklist says how to measure it before choosing the number.

### Not in RP-16

- Keeping frames for good (Q-RP-73 B); reading frames from studio storage by path; object storage.
- Notifications about frames that will expire, or about copies that differ.
- Per-shot grades (CDL); P3 and HDR copies.

### Tests (targeted, test database)

- **16.1:** frames kept after ready with `frames_until` set; 0 deletes them at once as today; the sweep discards them once due and not before; superseding still deletes the folder; the migration.
- **16.2:** a kept sequence is remade (frames linked, then processed as a sequence, burn-in date, colour space and `frames_until` kept); an expired one is refused with the new sentence; the project remake remakes kept sequences and counts the rest as `skipped_sequence`; deleting the remade copy's folder leaves the remake's frames.
- **16.3:** `differing` lists what the counts count, with `why`, `remakable` and the cap; reach and rights as C-RP-38.
- **16.4:** keep marks only differing copies that cannot be remade (other ids are a 400); kept copies stop counting; a later change of view or burn-ins counts them again; rights; audit.

### Mutation checks

Frames deleted at ready with a window set; the sweep discarding frames before their time; a remake starting a new window; a remake moving the frames instead of linking them; a sequence with expired frames remade; `differing` listing copies that match; a kept copy still counted; a kept copy not counted again after a settings change; keep accepted for a remakable copy.

### Gates

ruff check, `manage.py check`, `makemigrations --check`, basedpyright with no new errors in changed files, targeted backend tests (production, notifications, core); frontend typecheck, Biome, tests, build, unreachable check; capture and live runs; after the merge, CI green (no dependency change, so Containers and the dependency audit should not run).

## RP-17 Review copies from studio storage

**Status:** planned 2026-11-18; answered the same day (Q-RP-77 to Q-RP-81 = A, [DECISIONS.md](DECISIONS.md#rp-17-answers)); committed `d06c0572`, merged into `develop` and `main`, released in v4.14.0 ([rp-17-verification.md](rp-17-verification.md)). Branch `feature/rp-17-studio-storage-frames`, off `develop` at `63afd57c` (v4.13.0).

**Goal.** A review copy can be made from a file the pipeline has already published, read where it lies on studio storage, instead of uploading it through the browser. A 20 GiB EXR sequence is no longer sent over HTTP. A copy made this way can be remade at any time, because its source is never deleted.

### Why (what is there today)

- **Every review copy starts as an upload** (RP-5, RP-12): a movie or still in one request (up to `REVIEW_MEDIA_MAX_BYTES`), or a sequence in parts of 50 frames (up to `REVIEW_MEDIA_SEQUENCE_MAX_BYTES`, 20 GiB). The frames are written under `MEDIA_ROOT/review_media/`, although the studio already has them on its own storage.
- **RP-16 keeps uploaded frames for 14 days** only so that a sequence can be remade. That costs up to 20 GiB per sequence on the media volume, and after 14 days the sequence can no longer be remade.
- **Studio storage is already described and partly readable.**
  - `publishing.StorageRoot` names each root. `PublishedFile` registers a file or a sequence under a root by relative path, with its frame range, SHA-256 and status (Registered, Deprecated, Revoked). A registered file never changes (DOM-PUB-02).
  - `PUBLISHING_STORAGE_MOUNTS` (`{"<root code>": "<directory>"}`, empty by default) says which roots a server can read; checksum verification (`publishing.tasks.verify`) reads only those.
  - `publishing.domain.paths` already refuses unsafe relative paths (`normalize_relative_path`), finds each frame of a sequence pattern (`frame_file_name`), and joins a path to a mount refusing anything that leaves it, symbolic links included (`resolve_mount`).
- **The media worker reads only `MEDIA_ROOT`.** `celery-media` mounts `media_volume` alone (`compose.prod.yml`). Its sequence input is a folder `source/` of frames named `frame.%08d.<ext>` (`sequence.stored_pattern`).
- **Import direction:** publishing imports production (its FK to `Version`, production selectors); production never imports publishing. RP-17 keeps it that way.

### Work packages

| WP | Change | Files |
|---|---|---|
| 17.1 | **Shared path rules.** Move the pure functions `normalize_relative_path`, `frame_file_name`, `is_sequence_pattern` and `resolve_mount` to `apps/core/utils/paths.py`, which has no domain knowledge. `publishing.domain.paths` re-exports them, so its callers and tests do not change. The media worker uses the same checks as checksum verification. | `apps/core/utils/paths.py`, `apps/publishing/domain/paths.py` |
| 17.2 | **The row remembers a storage source** (Q-RP-77). `ReviewMedia` gains `storage_root` (root code, `""` for an upload), `storage_path` (the registered relative path, a sequence pattern for a sequence) and `published_file_id` (UUID, null, indexed; no FK, so production does not depend on publishing). Migration production `0014`, additive. The row's shape gains `published_file_id`; `source_name` is the file's name (the last path segment), with the range for a sequence. The path itself is not on the row, which is readable with `version.view` alone. | `models/review_media.py`, `api/serializers/review_media.py` |
| 17.3 | **Open a copy from a registered file** (Q-RP-77 to Q-RP-80). New `POST publishing/files/{id}/review-copy/`, body `{"color_space"?}`. The file must be in the caller's reach (`publishing.view` and the files' narrowing; a 404 otherwise). The caller must be allowed to manage the review copy of the file's version (C-RP-26). Refused with a 400 on `detail`, one sentence each: review media switched off; the file Revoked; its role not `main` or `proxy`; its checksum `mismatch` or `missing` (Q-RP-79); its root not in `PUBLISHING_STORAGE_MOUNTS` (names the root code, never a directory); its extension not a movie, still or frame format the worker reads; a sequence of more than `REVIEW_MEDIA_MAX_FRAMES` frames. 409 `review_media_busy` while the version has a copy in flight. A publishing service validates the file and calls a new `ReviewMediaService.open_from_storage(...)` with plain values; the row is `queued` and enqueued as an upload is. Audit `review_media_from_storage`. | `publishing/services/review_copy.py` (new), `publishing/api/viewsets/file.py`, `production/services/review_media.py` |
| 17.4 | **The worker reads the file where it lies** (Q-RP-78). For a row with a storage source, `process` builds `<folder>/source/` before running ffmpeg. For a sequence, each frame gets a symbolic link `frame.%08d.<ext>` to its real path. For a movie or still, `source.<ext>` gets one link. Each target is resolved with `resolve_mount` (inside the root's directory, symbolic links followed and checked), must be a regular file, and must start with its format's signature (as uploaded frames are sniffed). A missing or refused frame fails the job with `source_missing`, and the log carries the row id and frame number, never a path. The link folder is removed when the job ends; `rmtree` removes the links, never their targets. Nothing is ever written under a mount, which the checklist requires to be mounted read-only. Byte caps do not apply because nothing is stored; the frame cap and the job's time limit (27 minutes) do. | `production/services/review_media.py`, `transcode/sequence.py` |
| 17.5 | **Remake and revoke** (Q-RP-81). A copy with a storage source can be remade (C-RP-37) and is remade by the project remake (C-RP-38) at any time: the new row copies the storage fields and the worker reads the file again. `frames_until` stays `null` for these rows. `remakable` (C-RP-42) is true while the root is listed and the file not revoked. Revoking a file (`PublishedFileService.revoke`) clears the storage fields of copies made from it. They stay shown but cannot be remade, so they can be kept as they are (C-RP-43); a copy of it still in flight fails with `source_missing`. Revoking calls production directly, in the same transaction. | `production/services/review_media.py`, `production/selectors/review_media.py`, `publishing/services/files.py` |
| 17.6 | **Frontend.** The review movie panel gains **From a published file** next to Upload: a picker of the version's files that can be used (`GET publishing/files/?version_id=`, role main or proxy, not revoked), each showing its path, frames and checksum state, with the colour-space choice as for uploads. The published file page gains **Make review copy** for whoever may. The panel says "From published file <name>" on a copy made this way and links to the file for those holding `publishing.view`. There is no Remake refusal for these copies. Typed API from captured responses. | `frontend/src/api/`, `modules/production/review/`, `modules/publishing/` |
| 17.7 | **Capture, live, docs.** Capture tool and sample on real ffmpeg, with a temporary directory as a mounted root: an EXR sequence and a movie made from registered files; a remake; a revoke; the refusals, including a path through a symbolic link that leaves the root. A live file. CONTRACTS (C-RP-44 to C-RP-46), DECISIONS, **ADR-0042** (the media worker reads studio storage, read-only, only registered paths under listed roots), ADR-0040 amended, the pre-deploy checklist (the migration, the read-only mounts into `celery-media`, the same directories in every container that lists them), `rp-17-verification.md`. | `docs/sync/`, `docs/review-pipeline/`, `docs/adr/`, `docs/07-deployment/` |

### Questions before RP-17 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-77 | What can a review copy be read from? | A: a **registered published file** (role `main` or `proxy`, not Revoked), placed on that file's own version. B: any path under a listed root, typed in by the user. C: A, and also a path that is not registered yet. | **A**. Registration already decides that a path belongs to a version of a project, refuses unsafe paths, and freezes the record. The worker then reads only what the studio has declared, and the copy can name its source. B and C let anyone who can upload a review copy make the worker read any file under a root. |
| Q-RP-78 | Which roots may the media worker read, and where is that set? | A: the roots in **`PUBLISHING_STORAGE_MOUNTS`**, one setting for "which roots the servers can read", mounted read-only into `celery-media`. B: a separate `REVIEW_MEDIA_STORAGE_MOUNTS`. | **A**. One list of what the servers read, as checksum verification uses already. Each container mounts only what it needs, so the web container needs no mount for review copies: it only checks that the root is listed. B is two lists of the same directories, which can disagree. |
| Q-RP-79 | Is the checksum checked? | A: a file whose checksum is `mismatch` or `missing` is refused; `declared` and `verified` are accepted; nothing is hashed in the request or the job. B: the job hashes the file first and refuses on a mismatch, so every frame is read twice. C: no check. | **A**. Verification already records what is known, and RP-17 respects it. Hashing 20 GiB before every copy doubles the job for little: the worker reads what is there, and a later verification still flags a changed file. |
| Q-RP-80 | Are copies made automatically when a file is registered? | A: no: by hand on the version page or the file's page, and by pipeline tools through the same route (a personal access token). B: a project switch that makes a copy of every registered `main` movie or sequence. | **A**. A publish often registers several files per version (main, proxy, sidecars), and choosing which one is reviewed is the artist's or the tool's call. B can come later, once studios show which file they pick. |
| Q-RP-81 | What happens to copies made from a file that is then revoked? | A: they stay, as the record of what was reviewed, but can no longer be remade; one in flight fails. B: they are removed with the file. | **A**. A revoked file "must not be used" from now on, but notes and drawings were made on the copy and stay readable. Removing it would hide the review history. |

Also decided in the plan, without a question:
- **No new permission code.** Making a copy needs reach of the file (`publishing.view`) and the right to manage the version's review copy (C-RP-26). Artists hold both for their own versions.
- **Uploads stay.** Movies and sequences can still be uploaded, as before, for anything not on studio storage (client material, a quick test).
- **RP-16's keep window stays** for uploaded sequences. Copies from storage need none.
- **Paths do not leak.** Refusals name a root by code; logs carry ids and frame numbers; the review row carries the file's id and name, not its path.
- **Deprecated files can be used.** Deprecated means superseded, not wrong; Revoked is refused.

### Not in RP-17

- Automatic copies on registration (Q-RP-80 B).
- Reading paths that are not registered; object storage.
- Writing anything to studio storage (copies, proxies, thumbnails stay on the media volume).
- Notifications about copies; per-shot grades (CDL); P3 and HDR copies.

### Tests (targeted, test database)

- **17.1:** the moved functions behave as before (the publishing path tests run unchanged against the re-export).
- **17.2:** the migration; the row shape (`published_file_id`, `source_name`, no path).
- **17.3:**
  - a copy opened from a registered sequence and from a movie;
  - each refusal (switched off, revoked, wrong role, checksum mismatch and missing, root not listed, extension, too many frames, busy);
  - a file out of reach is a 404 identical to an unknown id;
  - rights as C-RP-26 (the version's artist with `version.create`, `version.update`);
  - the audit entry.
- **17.4:**
  - the job makes a copy from a sequence and a movie under a temporary root;
  - a frame through a symbolic link leaving the root fails the job and nothing outside is read;
  - a missing frame fails it;
  - a frame with the wrong signature fails it;
  - removing the link folder leaves the targets;
  - nothing is created under the root.
- **17.5:**
  - a storage copy is remade, and is remade by the project remake, without a window;
  - revoking clears the storage fields, the copy stays, remake is refused, keep is accepted;
  - a copy in flight fails;
  - unlisting the root makes it not remakable.

### Mutation checks

`resolve_mount` not called on a frame (a link leaving the root accepted); the signature not checked; the link folder removed by following links; a revoked file accepted; `mismatch` accepted; a root that is not listed accepted; the revoke not clearing the storage fields; a storage copy given a keep window; the path put on the row.

### Gates

ruff check, `manage.py check`, `makemigrations --check`, basedpyright with no new errors in changed files, targeted backend tests (production, publishing, notifications, core); frontend typecheck, Biome, tests, build, unreachable check; capture and live runs; after the merge, CI green (no dependency change, so Containers and the dependency audit should not run).

## RP-18 Review copies before approval

**Status:** planned 2026-11-18; answered the same day (Q-RP-82 to Q-RP-86 = A, [DECISIONS.md](DECISIONS.md#rp-18-answers)); committed `bfaf6466`, merged into `develop` and `main`, released in v4.15.0 ([rp-18-verification.md](rp-18-verification.md)). Branch `feature/rp-18-auto-review-copies`, off `develop` at `04b11f9e` (v4.14.0).

**Goal.** A version that is still in review gets its review copy from its render on studio storage, by path, without an upload and without being published first. A render-farm tool can ask for it as soon as a render finishes.

### Why (what is there today)

- **RP-17 helps only after approval.** It reads only registered published files. Registration refuses an unpublished version ("Unknown or unpublished version.", `PublishedFileService.register`), and only an `Approved` version can be published (`VersionService.publish_version`); nothing else sets `is_published`. In the usual flow (render, review, approve, publish, register), the copy that review needs is still uploaded. This was found while planning RP-18: its first proposal, automatic copies on registration (Q-RP-80 B), would have fired at the same late point.
- **The worker side exists.** RP-17's row fields (`storage_root`, `storage_path`), the per-job links checked with `resolve_mount` and the format's leading bytes, `_unlink_storage`, `storage_unreadable` and remaking from storage all work for a row without `published_file_id`.
- **Nothing bounds a path today.** Path templates (RP-4) are per file type, optional, and enforce only when switched on. Storage roots name whole studio volumes, shared by every project. [ADR-0042](../adr/ADR-0042-review-media-from-studio-storage.md) decision 1 says the worker reads "a `PublishedFile` id, never a path from a request". RP-18 changes that, so it needs a new ADR.

### Work packages

| WP | Change | Files |
|---|---|---|
| 18.1 | **The project's review folder** (Q-RP-83, Q-RP-86). `Project` gains `review_source_root` (a root code, blank = off) and `review_source_folder` (a relative folder, normalized with `normalize_relative_path`, required when the root is set, never the whole root). Written with `project.update`; the root must be listed in `PUBLISHING_STORAGE_MOUNTS` (production checks the setting, it does not import publishing). Migration production `0015`, additive. The project shape gains both, for those who may change the project only. | `models/project.py`, `api/serializers/project/`, `services/project.py` |
| 18.2 | **Open a copy from a path** (Q-RP-82, Q-RP-84). New `POST versions/{id}/review-media/from-storage/`, body `{"path", "first_frame"?, "last_frame"?, "color_space"?}`. `path` is relative to the project's folder (a sequence pattern needs the range). The upload's rights (C-RP-26), 409s and colour rules apply. 400 on `path` when the project has no review folder, the path is unsafe, leaves the folder, or is not a format the worker reads; 400 on the range as for a sequence upload. Stored as RP-17's storage source (`published_file_id` null) and queued. Audit `review_media_from_path`. | `production/services/review_media.py`, `production/api/viewsets/version.py` |
| 18.3 | **The worker checks the folder again.** At run time a path copy must still lie under the project's current folder on a listed root, else `storage_unreadable` with reason `outside_folder`. Otherwise RP-17's reading is unchanged. | `production/services/review_media.py` |
| 18.4 | **Remaking.** A path copy is remade by reading the path again, at any time, while it is still inside the project's folder and the root is listed. The row gains `source` (`upload`, `published_file`, `storage_path`); `storage_readable` covers path copies. Changing or clearing the project's folder makes older path copies not remakable; they can be kept as they are (C-RP-43). | `services/`, `selectors/review_media.py`, `api/serializers/review_media.py` |
| 18.5 | **Frontend.** The project's review settings gain the root and folder (for `project.update`). The review movie panel gains **From studio storage** when the project has a folder: a path field shown under `<root>:<folder>/`, the frame range prefilled from the version's frames for a pattern, and the colour-space choice. The copy reads "Read from studio storage: <file name>". Remake follows `storage_readable`. | `frontend/src/api/`, `modules/production/` |
| 18.6 | **For pipeline tools.** `docs/api/` gains a page with the request a render-farm tool sends after a render, using a personal access token with the artist's rights, and what each answer means. | `docs/api/` |
| 18.7 | **Capture, live, docs.** Capture tool and sample on real ffmpeg with a temporary root: a sequence and a movie of an unpublished version, a remake, a path through a symbolic link leaving the folder, a folder changed afterwards, the refusals. A live file. CONTRACTS (C-RP-47 to C-RP-49), DECISIONS, **ADR-0043** (amends ADR-0042: paths from a request, bounded by the project's folder), the pre-deploy checklist, `rp-18-verification.md`. | `docs/` |

### Questions before RP-18 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-82 | Where does an unpublished version's source come from? | A: a **path in the request**, stored on the review row as RP-17's storage source; the version stays unpublished and nothing is registered. B: let files be **registered to unpublished versions**, then use RP-17 as it is. C: a new production "review source" record that tools register, then a copy from it. | **A**. It reuses everything RP-17 built and changes no publishing rule. B breaks "a registered file is published output", which deliveries, the loader and dependencies rely on (DOM-PUB-02). C adds a record that holds the same two fields as the row. |
| Q-RP-83 | Which paths may be named? | A: only paths **under a folder the project declares** (one root and folder per project, set by whoever may change the project), checked in the request and again by the worker. B: paths that match one of the project's path templates. C: any path on a listed root. | **A**. Roots are shared by every project, so C would let an editor of one project see another project's renders as a review copy. B depends on templates that are optional and per file type. A is one setting, and `resolve_mount` already refuses links that leave it. |
| Q-RP-84 | How is a sequence's frame range known? | A: **the caller gives it** with the pattern; the panel prefills the version's frame range; missing frames fail the job. B: the worker lists the folder and takes the frames it finds. | **A**. The web container has no storage mount (ADR-0042), so it cannot look. B makes the range a surprise: a partial render would make a short copy that looks finished. |
| Q-RP-85 | Is anything automatic on the server? | A: **no**: the render-farm tool calls the route when a render finishes (a personal access token with the artist's rights), documented in WP 18.6. B: the server also sweeps the project's folder for new renders. | **A**. Only the farm knows when a render is complete; a sweep would read half-written frames and would need the web side to read storage. |
| Q-RP-86 | Who sees the project's folder and the paths? | A: the folder is in the project shape **only for those who may change the project**; review rows show the file name only; refusals never name a directory. B: every project reader sees the folder. | **A**. It keeps RP-17's rule that paths do not leak, which matters for client accounts that read projects. The artist types a path relative to the folder, which the panel shows as `<root>:<folder>/` only to those who may change it; others see "the project's review folder". |

Also decided in the plan, without a question:
- **No new permission code.** The route needs the upload's rights (C-RP-26).
- **Uploads and RP-17 stay.** Once a version is published, its registered files can still be used.
- **Nothing is written to storage**, and the worker's mounts stay read-only (ADR-0042).
- **A changed folder is not retroactive for the files**, only for remakes: copies already made stay shown.

### Not in RP-18

- Automatic copies on registration (Q-RP-80 B); watching folders (Q-RP-85 B).
- Registering files to unpublished versions (Q-RP-82 B).
- Folders per department or per file type; several folders per project.
- Writing to studio storage; object storage; notifications about copies.

### Tests (targeted, test database)

- **18.1:** the migration; the project writes (a root not listed, an unsafe folder, a folder without a root, clearing both); who sees the fields.
- **18.2:** a sequence and a movie of an unpublished version are queued; each refusal (no folder, unsafe path, `..`, absolute path, outside the folder, extension, range missing or too long, busy, switched off); the rights; the audit; no path in the row or the answer.
- **18.3:** a link inside the folder that leads out is refused; a folder changed after queuing fails the job with `outside_folder`; the log has no path.
- **18.4:** a path copy is remade and remade by the project remake; after the folder changes it is not remakable and can be kept; `source` for the three kinds.

### Mutation checks

The folder check skipped in the request; the folder check skipped in the worker; a path ending in `..` accepted; the project's root not required to be listed; the range taken from the disk; the folder shown to project readers; a path copy kept remakable after the folder changes; the path put on the row.

### Gates

ruff check, `manage.py check`, `makemigrations --check`, basedpyright with no new errors in changed files, targeted backend tests (production, publishing, notifications, core); frontend typecheck, Biome, tests, build, unreachable check; capture and live runs; after the merge, CI green.

## RP-19 Copy ready to review

**Status:** planned 2026-11-18; answered the same day (Q-RP-87 to Q-RP-91 = A, [DECISIONS.md](DECISIONS.md#rp-19-answers)); committed `d17c3ccd`, merged into `develop` and `main`, released in v4.16.0 ([rp-19-verification.md](rp-19-verification.md)). Branch `feature/rp-19-copy-notifications`, off `develop` at `fb63b0ba` (v4.15.0).

**Goal.** When a version's review copy is ready, the person who reviews that work is told, with a link to the copy. The version's artist is told too when someone else made the copy. With RP-18, a farm render of a version still in review then reaches its reviewer without anyone passing it on.

### Why (what is there today)

- **Only the person who made the copy is told.** `ReviewMediaFinishedHandler` (`notifications/events/handlers.py`) sends `review_media_ready` or `review_media_failed` to the row's `created_by` (RP-6, C-RP-24). That is the uploader, the caller of RP-17's or RP-18's route, or the owner of a render farm's token. A remake that becomes ready tells nobody (Q-RP-67).
- **The artist misses copies made for them.** When a coordinator, a producer's project remake or a farm account that is not the artist makes the copy, the version's artist hears nothing.
- **Nobody reviewing is told.** No notification goes to a reviewer when a copy arrives. `VERSION_STATUS` goes to the version's artist and the task's assignee; review kinds start only once a review exists (RP-11).
- **The data exists.** `Task.reviewer` (a user, nullable) is set in the task form and exposed as `reviewer_id`. A version belongs to a task (`Version.task`, nullable). `NotificationSources.version()` already returns the artist and the task's assignee; it can return the reviewer too. `FanoutService` already drops the actor, inactive people, muted kinds and anyone who may not open the version.

### Work packages

| WP | Change | Files |
|---|---|---|
| 19.1 | **The new kind** (Q-RP-91). `Kind.REVIEW_MEDIA_TO_REVIEW` = `review_media_to_review`, "A copy is ready for you to review"; target the version, `data` `{}`. Mutable. Migration notifications `0004` (the kind's choices only). | `notifications/constants.py`, `notifications/migrations/` |
| 19.2 | **Who is told** (Q-RP-87, Q-RP-88, Q-RP-89, Q-RP-90). `NotificationSources.version()` gains `task_reviewer_id`; the event payload is unchanged. On a **ready** copy that is not a remake: the row's creator `review_media_ready` (as today), the version's artist `review_media_ready`, the task's reviewer `review_media_to_review`, but only while the version is not `Approved` or `Archived`. On a **failed** copy: the creator and the version's artist `review_media_failed`; never the reviewer. A remake that becomes ready still tells nobody; a failed remake tells its creator and the artist. One row per person per event: if the reviewer is also the creator or the artist, they get `review_media_ready`, not both. | `notifications/events/handlers.py`, `production/selectors/notification_sources.py` |
| 19.3 | **Frontend.** The kind's label in the inbox ("Copy to review") and in notification preferences (the server's `mutable_kinds` lists it). The row reads "<version> is ready for you to review" and links to the version's Media tab, as the other review-media kinds do. Types, keys, describe text. | `frontend/src/api/notifications/`, `modules/notifications/` |
| 19.4 | **Capture, live, docs.** Recapture the notifications samples affected (the new kind in `mutable_kinds`). A capture of the three recipients for a farm-made path copy (RP-18's route). A live file. CONTRACTS (C-RP-50, C-RP-51), DECISIONS, the pre-deploy checklist, `rp-19-verification.md`. | `docs/` |

### Questions before RP-19 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-87 | Who is "the reviewer" of a version? | A: **the reviewer of the version's task** (`Task.reviewer`); a version with no task, or a task with no reviewer, tells no reviewer. B: as A, falling back to the **project's supervisor**. C: as A, plus the lead reviewer of any open review that already holds the version. | **A**. It is the one field that names who reviews this work, and the task form already sets it. B sends the supervisor of a large show every copy of every version not otherwise covered, and muting is all or nothing per kind, so it would end in a mute. C is already covered once a review exists: its people get the review kinds (RP-11). |
| Q-RP-88 | Which ready copies tell the reviewer? | A: **the first copy of a version's source** (an upload, a published file or a path), not a remake, and only while the version is not `Approved` or `Archived`. B: every ready copy, remakes included. | **A**. A remake shows the same work with other burn-ins or colour (Q-RP-67), and a copy of an approved or archived version is not waiting for anyone. A replaced upload counts as a new source and tells the reviewer again. |
| Q-RP-89 | Is the reviewer told when a copy fails? | A: **no**: failures go to whoever made the copy and to the artist, who can fix them. B: yes, with `review_media_failed`. | **A**. The reviewer cannot act on a failed copy; telling them is noise. |
| Q-RP-90 | Which of the artist's side is told? | A: **the version's artist**, with the existing `review_media_ready` / `review_media_failed`, when someone else made the copy. B: the artist and the task's assignee (as `version_status` does). C: nobody new. | **A**. The artist is the person whose work it is. The assignee is usually the artist; when not, they still see the version's status kinds. |
| Q-RP-91 | Can the new kind be muted? | A: **yes**, like every kind not addressed by name. B: no, like `note_mention` and `review_invited`, as a request for action. | **A**. It is not a request with a deadline; a reviewer who follows the review queue instead can turn it off. |

Also decided in the plan, without a question:
- **No new permission code, no new setting, no change to the event.** The handler reads the task's reviewer when the event is handled, so a reviewer changed between queuing and ready is the one told.
- **The reach rule stays.** A reviewer who may not open the version (an external member outside its reach) is not told (C-RP-24).
- **Nothing else changes in how copies are made.**

### Not in RP-19

- E-mail or any channel outside StudioHub; digests.
- A reviewer field on versions; review queues or assignment rules.
- Telling reviewers about status changes (`version_status` stays the artist's and assignee's).
- Downloading a copy, slates, per-shot grades (CDL), automatic copies on registration.

### Tests (targeted, test database)

- **19.1:** the migration; the kind is in `mutable_kinds` and can be muted.
- **19.2:** a ready upload tells the creator and the task's reviewer; a farm-made path copy (RP-18) tells the farm account's owner, the artist and the reviewer, once each; a reviewer who made the copy gets `review_media_ready` only; no task, no reviewer, an `Approved` or `Archived` version: no `review_media_to_review`; a remake that becomes ready tells nobody; a failure tells the creator and the artist, never the reviewer; a muted kind is not written; a reviewer outside the version's reach is not told; the reviewer read at handling time.
- **19.3:** the label, the text, the link, the preferences list (from captured samples).

### Mutation checks

The reviewer told on a remake; the reviewer told on a failure; the reviewer told for an approved version; the artist not told when someone else made the copy; two rows for a reviewer who made the copy; the reviewer read from the event instead of at handling time; the new kind unmutable.

### Gates

ruff check, `manage.py check`, `makemigrations --check`, basedpyright with no new errors in changed files, targeted backend tests (notifications, production, core); frontend typecheck, Biome, tests, build, unreachable check; capture and live runs; after the merge, CI green.

## RP-20 Per-shot grades on review copies

**Status:** planned 2026-11-18; answered the same day (Q-RP-92 to Q-RP-96 = A, [DECISIONS.md](DECISIONS.md#rp-20-answers)); built on `feature/rp-20-shot-grades`, off `develop` at `176c1ad3` (v4.16.0), committed `10f16b62`, merged into `develop` and `main`, released in v4.17.0 ([rp-20-verification.md](rp-20-verification.md)).

**Goal.** A shot's grade (its ASC CDL: slope, offset and power per channel, and saturation) is applied to its versions' review copies, so supervisors judge comp against the graded picture, as in the DI and in the client's dailies. Grades are typed on the shot or imported from the client's `.cc`, `.ccc` or `.cdl` files; copies made with an older grade can be remade (RP-14, RP-15).

### Why (what is there today)

- **Every shot of a project looks the same.** RP-15 applies one transform per project: the input colour space, a view and an optional look (`transcode/colour.py`). A shot's own grade is applied nowhere, so a shot graded warm and dark in the DI shows neutral and bright in review. Per-shot grades have been left out of every colour phase since RP-15 ("Not in RP-15", RP-16, RP-17, RP-19) and are a known limit in each release since v4.12.0.
- **Nothing holds a grade.** `Shot` has no colour field. `Version.color_space` is free text that nothing reads (RP-15). There is no route that takes a CDL file.
- **The bake can carry it** (spike below). OpenColorIO applies a CDL as a look in the config's `color_timing` space (ACEScct in the ACES configs), and the existing `Baker` call bakes that look into the same LUT as the project's view.

**Spike** (this host, `opencolorio` 2.6.0, the pinned ACES 2.0 studio config, ACEScg input, view "ACES 2.0 - SDR 100 nits (Rec.709)"). The grade was slope (1.1, 1.0, 0.9), offset (0.01, 0, −0.01), power (1, 1, 1.05) and saturation 0.9.
- **Mid grey 0.18** shows as 89 without the grade and as (137, 86, 52) with it.
- **The same values written as a `.cc` file**, read through OpenColorIO's `FileTransform`, give the identical result.
- **Baking a LUT with the grade** takes 0.43 s, the same as without it. The LUT has the same 65³ cube and 4096-point shaper, and is 7.5 MB.

### Work packages

| WP | Change | Files |
|---|---|---|
| 20.1 | **The grade** (Q-RP-92, Q-RP-95). `Shot` gains `grade` (JSON, null = none): `slope` (3 numbers, 0 to 10), `offset` (3, −1 to 1), `power` (3, above 0 and up to 10) and `saturation` (0 to 10). It also gains `grade_source` (the file name and correction id it was imported from, or blank when typed) and `grade_updated_at`. Written through the shot's update (`shot.update`, the reach and narrowing of the single route); `null` clears it. The shot shape gains the three fields. `Project` gains `review_grades` (default false), written like `review_burn_ins`. Migration production `0016`, additive. | `models/shot.py`, `models/project.py`, `validators/grade.py`, shot and project serializers |
| 20.2 | **Import from the client's files** (Q-RP-93). New `POST projects/{id}/grades/import/`, multipart: `file` (`.cc`, `.ccc` or `.cdl`, at most 1 MiB) and `dry_run` (default true). It is parsed with the standard library's `ElementTree` (Expat 2.6: entities are not expanded without limit and external ones are not fetched); a `DOCTYPE` is refused. Each `ColorCorrection` `id` is matched to a shot code, ignoring case, either alone or after the project's code and `_`. The answer lists `matched` (shot code, old and new grade), `unchanged`, `unmatched` ids, `invalid` corrections (with the field) and `skipped` (shots the caller may not update, by CR-46's narrowing). Without `dry_run` the matched shots are written in one transaction. At most 2,000 corrections per file. Audit `shot_grades_imported`. | `production/services/grade_import.py`, `api/viewsets/project.py`, `api/serializers/grade.py` |
| 20.3 | **Processing** (Q-RP-94, Q-RP-95). When the project's `review_grades` is on, a colour-managed copy (one with an OpenColorIO target, RP-15) of a version whose shot has a grade gets it. The grade is applied as a look in the config's `color_timing` space, before the project's look. The LUT is baked per job into the job's folder and removed with it, so a project's shots do not leave one 7.5 MB file each; LUTs without a grade stay cached as today. `probe.ocio` gains `grade` (the values applied, or `null`). If the config has no log `color_timing` space, the copy is made without the grade and records `grade_skipped: "no_grading_space"`. Display-ready movies and asset versions are unchanged. | `production/transcode/colour.py`, `selectors/review_media.py`, `services/review_media.py` |
| 20.4 | **Copies made with another grade** (Q-RP-96). C-RP-38's differences gain the reason `grade`: a ready copy whose `probe.ocio.grade` is not what it would be made with now, the switch included. The project remake remakes such movies and stills, and sequences while their frames are kept (RP-16). "Keep as they are" (C-RP-43) covers them. | `selectors/review_media.py`, `services/review_media.py` |
| 20.5 | **Frontend.** The shot form gains **Grade (ASC CDL)**: slope, offset and power for R, G and B, saturation, and Clear; it shows where the grade came from. The project's review settings gain **Apply shot grades to review copies** and **Import grades…**. The import is a dialog: choose a file, see the dry run (matched, unchanged, unmatched, invalid, skipped), then Apply. The review movie panel says "Graded with the shot's CDL" (and from which file), or why not. The copies notice names the reason "made with another grade". | `frontend/src/api/production/`, `modules/production/`, `modules/shots/` |
| 20.6 | **Capture, live, docs.** A capture on real ffmpeg with OpenColorIO: a typed grade, an import (dry run, apply, refusals, a `DOCTYPE`), an EXR sequence graded, a changed grade counted and remade, a config without `color_timing`. A live file. CONTRACTS (C-RP-52 to C-RP-54), DECISIONS, a note in ADR-0041 (grades as a look in the grading space; graded LUTs not cached), the pre-deploy checklist, `rp-20-verification.md`. | `docs/` |

### Questions before RP-20 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-92 | Where does a grade live? | A: **on the shot**; every version of the shot gets it. B: on the shot, and a version may override it. C: on the version only. | **A**. A CDL comes per shot from the DI or the client, and every version of the shot is judged against the same grade. B adds a second place to look for a rare case; it can follow if supervisors ask. C would mean entering the grade again for every version. |
| Q-RP-93 | How do grades get in? | A: **typed on the shot, and imported from `.cc`, `.ccc` and `.cdl` files** uploaded on the project, matched to shot codes, with a dry run first. B: typed only. C: read by the worker from a file next to each shot on studio storage. | **A**. Clients send grades as one collection for a reel, so typing 300 shots (B) would not happen. C ties grades to a folder convention per show and to the storage mount; an upload works for every studio. The dry run shows mismatched ids before anything changes, as bulk add does (CR-48). |
| Q-RP-94 | Where in the transform is the grade applied? | A: **in the config's `color_timing` space** (ACEScct in the ACES configs), before the project's look. B: in the copy's input space. C: after the project's look. | **A**. ASC CDLs for ACES shows are made in ACEScct; applying them elsewhere gives a different picture from the DI. The config names that space as its `color_timing` role, so a studio config is followed too. |
| Q-RP-95 | Which copies get the grade? | A: **colour-managed copies only** (an OpenColorIO target: EXR frames, or an upload naming a colour space), and only while the project's **switch is on, off by default**. B: as A, but always on when a shot has a grade. C: every copy, display-ready movies included. | **A**. A display-ready movie is often already graded, and grading it again would double the grade (C). With the switch off by default, nothing changes on upgrade until a project chooses it, and turning it off is the way back (B has none). |
| Q-RP-96 | What happens to copies when a grade changes? | A: **they are counted** in the project's review-copies notice with the reason "grade" and **remade by the project remake** (movies, stills, and sequences while their frames are kept). B: remade automatically when a grade changes. | **A**. One import can change hundreds of grades. Remaking them all at once (B) would fill the media queue and replace copies under reviewers' notes without anyone choosing it. The notice and "Keep as they are" already handle colour and burn-in changes. |

Also decided in the plan, without a question:
- **No new permission code.**
  - A shot's grade is written with `shot.update` and read with the shot.
  - The import needs `shot.update`, and skips the shots the caller may not update.
  - The project switch uses the project's write rights, as the burn-in switch does.
- **No new dependency.** The parser is the standard library's; OpenColorIO is already there (RP-15).
- **Graded LUTs are not cached.** One per shot would fill the media volume; a bake takes about 0.4 s per job.
- **The trust model does not change**, so there is no new ADR, only a note in ADR-0041.

### Not in RP-20

- Grades per version (Q-RP-92 B) or per sequence; looks per shot.
- Reading grades from EDLs (`*ASC_SOP` comments), ALEs or studio storage (Q-RP-93 C).
- Exporting grades; showing the copy without its grade beside the graded one.
- P3 and HDR copies; 10-bit copies; slates; downloading a copy.

### Tests (targeted, test database)

- **20.1:** the migration; the shot writes (each bound, three numbers each, `null` clears, unknown keys refused); the rights and narrowing; the switch.
- **20.2:** each file kind; ids matched with and without the project's code; `unchanged`, `unmatched`, `invalid`, `skipped`; the dry run writes nothing; apply is atomic; the size and count caps; a `DOCTYPE`; a file that is not XML; the audit.
- **20.3:** a graded EXR sequence (the LUT includes the grade, `probe.ocio.grade` recorded); switch off or no grade gives today's copy; a display-ready movie is never graded; a config without `color_timing` records `grade_skipped`; the graded LUT is gone after the job.
- **20.4:** a changed grade, a cleared grade and the switch each count with reason `grade`; the remake applies the current grade; "Keep as they are".

### Mutation checks

The grade applied with the switch off; the grade applied to a display-ready movie; the grade applied in the input space; the graded LUT cached; the dry run writing; a `DOCTYPE` accepted; an id matched by prefix (`SH01` matching `SH010`); a shot the caller may not update written; the grade left out of the differences.

### Gates

ruff check, `manage.py check`, `makemigrations --check`, basedpyright with no new errors in changed files, targeted backend tests (production, notifications, core); frontend typecheck, Biome, tests, build, unreachable check; capture and live runs; after the merge, CI green.

## RP-21 The task and its reviewer on the version page

**Status:** planned 2026-11-19; answered the same day (Q-RP-97 to Q-RP-100 = A, [DECISIONS.md](DECISIONS.md#rp-21-answers)); built on `feature/rp-21-version-reviewer`, off `develop` at `fbb1a370` (v4.17.1), committed `5b303561`, merged into `develop` and `main`, released in v4.18.0 ([rp-21-verification.md](rp-21-verification.md)).

**Goal.** The version page says which task the version is for and who reviews it, with a link to the task. A reviewer who opens a copy from RP-19's "Copy to review" sees the version is theirs to review. An artist sees who their work goes to.

### Why (what is there today)

- **The version page never names its task.** Its overview shows the department, the artist, frames, resolution, frame rate, colour space and dates (`VersionWorkspace.tsx`). The version's answer carries only `task_id` (`VersionSerializer`), and nothing on the page uses it. To find the task, or who reviews it, you go through the shot.
- **The reviewer is only on the task.** `Task.reviewer` is set in the task form. The task's answer serves `reviewer_id` and `reviewer_name`, and the task page shows them. Since RP-19, the reviewer is told when a copy is ready, but the version page they land on doesn't say they are the reviewer.
- **The version's artist is often empty.** The Versions screen never sets `Version.artist` (RP-11, C-RP-28), so the overview's *Artist* is usually "—". The task names who did the work (its assignee) and who reviews it.
- **The data is readable already.** Every built-in role with `version.view` also has `task.view`. `GET tasks/{id}/` applies the external scope (`selectors/external_scope.py`):
  - a vendor member reads the tasks of their vendor, and so the task of every version they can see;
  - a client member reads no task, but does read the versions in their reviews.

  So asking for the task shows it to studio staff and vendors, and gives a client member a 404.

### Work packages

| WP | Change | Files |
|---|---|---|
| 21.1 | **The task on the version page** (Q-RP-97, Q-RP-98, Q-RP-100). When the version has a `task_id`, the page reads the task (`tasksApi.get`, only with `task.view`). The overview gains three facts after *Artist*: **Task**, the task's code and title, linked to `/tasks/{id}`; **Assignee**; **Reviewer**. Each shows "—" when empty. A version with no task shows none of the three. A refused read (404 or 403: a client member, or a custom role without `task.view`) shows none of the three and no error; any other failure shows them as "—". | `modules/production/review/VersionWorkspace.tsx` |
| 21.2 | **Who reviews it, said once** (Q-RP-99). When the signed-in person is the task's reviewer, the Reviewer fact reads "You". No other change to the page. | same |
| 21.3 | **Capture.** A new tool, `test_capture_version_task.py`. It records a version with a task, and that task's detail with an assignee and a reviewer. It also records a client member who reads the version (in a review they take part in) and gets 404 for its task, and a vendor member who reads both. | `docs/sync/tools/`, `docs/sync/samples/production/` |
| 21.4 | **Tests, live, docs.** Frontend tests from the samples, and a live file. DECISIONS, `rp-21-verification.md`, and a pre-deploy checklist line. | `frontend/src/modules/production/review/__tests__/`, `frontend/src/test/live/`, `docs/` |

### Questions before RP-21 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-97 | Where do the task and reviewer show? | A: **three facts in the overview**, after *Artist*: Task (linked), Assignee, Reviewer. B: one line under the title, beside the shot and project ("Comp · SH0010 · reviewed by Mia"). C: both. | **A**. The overview is where the version's facts are, and the facts grid already takes "—" for an empty value. A line under the title is easy to miss on a busy page, and C says the same thing twice. |
| Q-RP-98 | How does the page read them? | A: **it asks for the task** (`GET tasks/{task_id}/`); whoever may not read the task sees none of the three. B: a backend change request: the version's answer gains `task_code`, `task_title`, `task_assignee_name` and `task_reviewer_name`. | **A**. No backend change, and the external scope already decides who sees the task: a client member gets 404, so the studio's assignee and reviewer never reach the client. B would serve those names with every version, to client members too, unless the version serializer copied the external scope. The cost is one extra request on a page that already makes several. |
| Q-RP-99 | Does the page say when the reviewer is you? | A: **yes**: the Reviewer fact reads "You". B: no, the name only. | **A**. A reviewer arriving from "Copy to review" should see at a glance that it is theirs. It is one comparison with the signed-in user, already known from `/auth/me`. |
| Q-RP-100 | Can the reviewer or assignee be changed from the version page? | A: **no**: the Task link opens the task, whose edit page sets both. B: a reviewer picker on the version page for holders of `task.update`. | **A**. The task form already owns these fields and their rules (members only, the project's people). A second editor would duplicate that and its tests. |

Also decided in the plan, without a question:
- **No backend change, no migration, no new permission code or setting, and no API contract change.**
- **Only the version page.** The Versions list and the review player stay as they are.
- **The version's own *Artist* stays**, as it is today; the Assignee fact sits next to it.

### Not in RP-21

- A reviewer field on versions; review queues or assignment rules (RP-19 left these out too).
- The task on the Versions list or in the review player.
- E-mail or digests; P3 and HDR copies; grades from EDLs or ALEs.

### Tests (frontend, from captured samples)

- **21.1:**
  - a version with a task shows the Task link (code and title, to the task's page), the assignee and the reviewer;
  - a task without a reviewer shows "—";
  - a version without a task shows none of the three and asks for no task;
  - a 404 or 403 for the task (the client member's capture) shows none of the three and no error;
  - a 500 shows the facts as "—";
  - without `task.view` the task is not asked for.
- **21.2:** the reviewer signed in sees "You"; anyone else sees the name.
- **Live:** against a seeded backend, a version page shows its task and reviewer. A client member's version page shows neither and no error.

### Mutation checks

The task read without `task.view`; a 404 shown as an error; the facts shown for a version without a task; "You" for someone who is not the reviewer; the link to the wrong task.

### Gates

Frontend typecheck, Biome (0 errors, 910 warnings), tests, build, unreachable check; ruff check on the new capture tool; the capture and the live run; after the merge, CI green.

## RP-22 Grades from EDLs and ALEs

**Status:** planned 2026-11-19; answered the same day (Q-RP-101 to Q-RP-104 = A, [DECISIONS.md](DECISIONS.md#rp-22-answers)); built on `feature/rp-22-edl-ale-grades`, off `develop` at `876fbacb` (v4.18.0), committed `d5d2576c`, merged into `develop` and `main`, released in v4.19.0 ([rp-22-verification.md](rp-22-verification.md)). Chosen over notification e-mail, which would reverse Q-RP-7 (in-app only).

**Goal.** *Import grades…* also reads the two files a DI house most often sends grades in: an **EDL** whose events carry `*ASC_SOP` and `*ASC_SAT` comments, and an **ALE** with `ASC_SOP` and `ASC_SAT` columns. They use the same dry run, the same matching to shot codes and the same all-or-nothing apply as RP-20's `.cc`, `.ccc` and `.cdl` files.

### Why (what is there today)

- **Only CDL XML files are read.** `transcode/cdl.py` parses `.cc`, `.ccc` and `.cdl`, and anything else is refused ("Choose a .cc, .ccc or .cdl file."). Many grades arrive another way:
  - in the cut, as a CMX 3600 EDL whose events carry the grade as comments (`*ASC_SOP (1.1 1.0 0.9)(0.01 0.0 -0.01)(1.0 1.0 1.05)` and `*ASC_SAT 0.9`);
  - from dailies tools, as an Avid ALE with `ASC_SOP` and `ASC_SAT` columns.

  Today a coordinator has to type those grades one shot at a time.
- **The rest exists.** `GradeImportService` matches a list of corrections (an id and a grade) to the project's shots, answers the dry run and writes in one transaction with one audit row (C-RP-54). An EDL or ALE reader only has to produce that list. The grade, its bounds (`clean_grade`), the review copies and the remake are unchanged.
- **The shot is named differently.** A CDL correction has an `id`; an EDL event or ALE row has no field for the shot. A shot code usually appears in one of these:
  - an EDL event's locator (`* LOC: 01:00:02:00 YELLOW SH0010`);
  - its clip name (`* TO CLIP NAME:`, `* FROM CLIP NAME:`);
  - its reel;
  - an ALE column such as `Shot`, `VFX` or `Name`.

### Work packages

| WP | Change | Files |
|---|---|---|
| 22.1 | **The readers** (Q-RP-101, Q-RP-102, Q-RP-104). `transcode/grade_files.py`: `.edl` and `.ale` beside the CDL files; each gives a list of corrections like `cdl.parse`. The text is read as UTF-8, or Latin-1 when it is not UTF-8.<br>**EDL:** an event starts at its number line. Its comment lines follow: `*ASC_SOP` (three groups of three numbers, spaces and parentheses as written by Resolve, Baselight and Avid) and `*ASC_SAT` (one number); either alone is valid, and a missing one changes nothing. The event's names are its locators, then its clip names (TO, then FROM, without the extension), then its reel.<br>**ALE:** the `Column` line names the columns; each `Data` row is read by them. The names are the `Shot`, `VFX`, `VFX ID` or `Shot Name` column (in that order), then `Name`.<br>An event or row with neither grade comment is **ungraded**: counted, not listed. One with a grade and no name is invalid on `id`. A grade that cannot be read is invalid on its field. At most 2,000 graded events or rows; 1 MiB, as now. | `production/transcode/grade_files.py` (new), `cdl.py` (the extensions) |
| 22.2 | **Matching** (Q-RP-101, Q-RP-103). Each name of an event, in order, is looked up as an id is today (the code, with or without the project's code, ignoring case). The first name that matches a shot names it; names that match different shots make the event invalid. Several events for one shot with **the same grade** are one correction. **Different grades** make every one of them invalid, and the shot is not written. The source is `"<file> (event <n>: <name>)"` or `"<file> (row <n>: <name>)"`. | `production/services/grade_import.py` |
| 22.3 | **The answer** (C-RP-55, extends C-RP-54). The same fields. `id` in `matched`, `unchanged`, `unmatched` and `invalid` is `"event <n>: <name>"` or `"row <n>: <name>"` for these files; an unmatched event lists every name tried. New `ungraded`: the number of events or rows without a grade (0 for CDL files). The route, rights, caps, dry run and audit row are as C-RP-54. | `production/api/serializers/grade.py`, `viewsets/project.py` |
| 22.4 | **Frontend.** The file input takes `.edl` and `.ale`, and the dialog's text names them. The dry run's lists show the event or row ids, and "N events without a grade" when `ungraded` is not 0. Types and keys. | `modules/shots/components/GradeImport.tsx`, `api/production/work.ts` |
| 22.5 | **Capture, live, docs.** Recapture `production/_shot_grades_flow.json` with an EDL and an ALE (dry run, apply, ungraded events, a shot in two events, two names for two shots). A live file. `docs/api/shot-grades-import.md`, CONTRACTS (C-RP-55), DECISIONS, `rp-22-verification.md`. | `docs/` |

### Questions before RP-22 starts

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q-RP-101 | Which part of an EDL event names the shot? | A: **each in turn**: the locators, the clip names (TO, then FROM, without the extension), the reel; the first that matches a shot names it, and names matching different shots make the event invalid. B: the locators only. C: the dialog asks which (locator, clip name, reel). | **A**. Facilities differ: some put the VFX id on a locator, some rename the clip, some use the reel. Trying each in a fixed order reads every common layout without a setting. A name matches only a whole shot code, never part of one, so a camera clip name (`A001C003_220101`) matches nothing. Two names for two shots are refused, not guessed. C makes everyone learn their EDL's layout. |
| Q-RP-102 | Which ALE column names the shot? | A: **the first present** of `Shot`, `VFX`, `VFX ID`, `Shot Name` (ignoring case), then `Name`, each tried as in Q-RP-101. B: `Name` only. C: the dialog asks for the column. | **A**. Dailies tools put the clip's name in `Name` and the VFX id in a column a coordinator adds. Trying the usual names first, then `Name`, reads both. |
| Q-RP-103 | One shot in several events (cut in twice, or across a dissolve)? | A: **the same grade** in each is one correction; **different grades** make every one of them invalid, and the shot keeps its grade. B: as for CDL files today: the first wins and the later ones are invalid. | **A**. A shot cut in twice is normal in an EDL and is not an error. Different grades for one shot are a question for the colourist, and picking one by its order in the cut would hide it. |
| Q-RP-104 | Events and rows without a grade? | A: **counted** (`ungraded`), not listed: black, titles and clips the colourist did not grade are normal in a cut. B: each listed as invalid. | **A**. A 200-event cut with 40 graded VFX shots would otherwise show 160 errors. The count still says how much of the file was read. |

Also decided in the plan, without a question:
- **No new route, permission code, setting or migration.** The route, its rights (`shot.update`, the single routes' narrowing), its caps (1 MiB, 2,000 graded entries) and its audit row are C-RP-54's.
- **The grade's bounds are RP-20's** (`clean_grade`), whatever the file.
- **No ADR:** the trust model doesn't change. The files are text, read with no parser that fetches anything.

### Not in RP-22

- FCPXML, AAF or OpenTimelineIO files; EDLs other than CMX 3600 (File 32, File 128 and GVG are read only where they share its event and comment lines).
- Exporting grades; per-version grades; reading grades from studio storage (Q-RP-93 C).
- Notification e-mail (Q-RP-7 stands).

### Tests (targeted, test database)

- **22.1:**
  - EDL: Resolve's, Baselight's and Avid's spelling of `*ASC_SOP` and `*ASC_SAT`; SOP or SAT alone; a transition (two events, one grade); locators, clip names and reels; a Latin-1 file; ungraded events;
  - a grade out of bounds, or one that cannot be read;
  - ALE: each name column, columns in any order, a row shorter than the columns;
  - the caps; a file that is neither.
- **22.2:**
  - each name in order; a camera clip name matching nothing; two names for two shots;
  - one shot twice with the same grade and with different grades;
  - the source text;
  - a shot the caller may not update stays unmatched.
- **22.3:** the answer's fields; `ungraded`; CDL files unchanged (RP-20's tests pass as they are).
- **22.4:** the input's accept list, the dialog's text, event ids and the ungraded line (from captured samples).

### Mutation checks

A name matching part of a code; the first name taken when a later one matches a different shot; different grades for one shot written; an ungraded event listed as invalid; the TO clip name tried after FROM; a Latin-1 file refused; the 2,000 cap counting ungraded events.

### Gates

ruff check, `manage.py check`, `makemigrations --check`, basedpyright with no new errors in changed files, targeted backend tests (production); frontend typecheck, Biome, tests, build, unreachable check; capture and live runs; after the merge, CI green.
