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

**Status:** approved 2026-11-12, every recommendation taken (Q-RP-11 to Q-RP-14 = A, [DECISIONS.md](DECISIONS.md#rp-2-answers)). Backend (WP 2.1 to 2.6) built on `feature/rp-2-notes` ([rp-2-verification.md](rp-2-verification.md)); WP 2.7 (frontend) next. Two points of this plan turned out differently; see the corrections below.

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

## RP-3 to RP-6

Not planned in detail yet. Each phase is written here before it starts, from [ANALYSIS.md §8](ANALYSIS.md#8-draft-phases-to-be-fixed-after-9-is-answered) and [DECISIONS.md](DECISIONS.md).
