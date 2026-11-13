# RP-6 Notifications (in-app): verification

Branch `feature/rp-6-notifications`, off `develop` at `c0459cfc` (RP-1 to RP-5 merged, v4.6.0 released). The plan and contracts are commit `bd817bdc` (Q-RP-32 to Q-RP-40 answered as recommended). **Backend (WP 6.1 to 6.4), frontend (WP 6.5) and docs (WP 6.6) are built and committed on this branch**, followed by a separate commit that removes the dead toast-store actions (section 0, item 4). Merged into `develop` as `e5346727` and into `main` as `94f7342c`; released as v4.7.0.

## 0. Read first

1. **The plan named two things wrongly; both are corrected in PLAN and CONTRACTS.**
   - There is no single `POST tasks/{id}/assign/`. An assignee is set by create, `PATCH`/`PUT`, `bulk-assign/`, `bulk-create/` and `bulk-update/`. All of them go through `TaskService` (`create`, `update`, `assign_task`), which is now the one place `TaskAssigned` is published. A test covers each route.
   - The model has no `thread_id`: a note row's `target_id` is its thread.
2. **A member narrowed to a show, a department, a client or a vendor gets no note rows, even for a thread they wrote.** The general scoping shows such a member their own notes. Every notes route asks for whole-project access, though (C-RP-10, they answer 404), so the inbox does the same. Task and version rows still reach them where those records are in their narrowing.
3. **One person can get two `note_mention` rows on one thread.** A reply that mentions them and an edit that adds them to the thread are two separate actions. The capture shows it: the supervisor's reply mentions the artist, then the lead's edit adds the artist to the thread.
4. **The header bell changed meaning.** It used to list this tab's toasts, and it lost them on reload. It now shows the server's inbox (Q-RP-39 = A). Toasts themselves are unchanged. The toast store's `markAsRead`, `markAllAsRead` and `clearNotification` had no other caller and were removed. Its toast history (`notifications`) stays, because eight test files read it.
5. **A person without a display name appears by their e-mail** (the actor in a row, a mention chip, the mention picker). Note authors already appear this way.

## 1. What changed

| WP | Contract | Change | Files |
|---|---|---|---|
| 6.1 | C-RP-23 | New app `apps/notifications`. <ul><li>`Notification` (migration `0001`), with indexes on (recipient, read_at, created_at) and on created_at.</li><li>Routes: list (filters `unread`, `project_id`, `kind`; an unknown value gives none), `unread-count/`, `{id}/read/`, `{id}/unread/`, `read-all/` (optional `before`).</li><li>Own rows only; another person's id is 404.</li><li>Reach is one subquery per target type, through production's selectors (`readable_query`), so paging and the count come after the check.</li><li>Labels are read from the live records on each answer.</li><li>Read-only admin.</li></ul> | `backend/apps/notifications/{models,migrations,selectors,services,api,admin}/`, `backend/apps/production/selectors/notification_sources.py`, `backend/config/settings/components/apps.py`, `backend/config/v1_urls.py` |
| 6.2 | C-RP-24 | <ul><li>New events `TaskAssigned` (from `TaskService.create`, `update` and `assign_task`) and `ReviewMediaFinished` (at the worker's finish, its failure and the sweep; the sweep now locks each row).</li><li>Handlers for the note events, `NoteMentioned`, `TaskAssigned`, `StatusChanged` (tasks and versions) and `ReviewMediaFinished`.</li><li>`FanoutService` drops the actor, keeps active users in reach, merges kinds (a mention wins) and writes one `bulk_create`.</li><li>Each handler logs `notification_fanout_failed` and swallows its own error.</li></ul> | `backend/apps/notifications/{events,services}/`, `backend/apps/production/events/{tasks,review_media,notes}.py`, `backend/apps/production/services/{task,review_media}.py` |
| 6.3 | C-RP-25 | <ul><li>`ProjectNoteMention` (production migration `0009`, read-only admin).</li><li>`mention_ids` on note create, reply and `PATCH` (at most 20, repeats kept once). Each person must be active and able to read the thread; otherwise a 400 with one message.</li><li>Create and reply carry the mentions in their events. An edit publishes `NoteMentioned` for the people it adds.</li><li>`mentions` `[{id, name}]` in the note shape, prefetched.</li></ul> | `backend/apps/production/{models/project_note.py,migrations/0009_rp6_note_mentions.py,validators/project_note.py,services/project_note.py,api/serializers/project_note.py,api/views/project_notes.py,selectors/project_note.py,admin/project_scoped.py}` |
| 6.4 | C-RP-24 | Celery task `notifications.purge` (beat entry daily at 04:10; deletes in batches of 5000). `NOTIFICATIONS_RETENTION_DAYS` (default 90). | `backend/apps/notifications/{tasks,services/purge.py}`, `backend/config/{env.py,settings/base.py,settings/components/{notifications,celery}.py}`, `backend/.env.example` |
| 6.5 | | <ul><li>Header bell: the count is polled every minute while the tab is visible and on focus. The panel loads the newest 20 rows. A row opens its record and marks itself read. "Mark all read" stops at the newest row shown.</li><li>`/notifications` page: unread and kind filters, per-row read and unread, pagination.</li><li>A version page opens the tab named in `?tab=` (`media`, `notes`).</li><li>`MentionPicker` on the note form (an edit sends `mention_ids` only when changed) and on the reply box. Mentions are shown on threads and replies.</li><li>Typed API and row keys. OpenAPI regenerated (additions only: the five routes).</li><li>Route registry and permission map (`page.notifications` is open; its old "removed" rule was dropped).</li></ul> | `frontend/src/api/notifications/`, `frontend/src/modules/notifications/`, `frontend/src/modules/production/notes/{MentionPicker,NoteBoard,NoteFormDialog}.tsx`, `frontend/src/modules/production/review/VersionWorkspace.tsx`, `frontend/src/layouts/Header.tsx`, `frontend/src/api/production/{structure,structureRowKeys}.ts`, `frontend/src/routes/AppRoutes.tsx`, `frontend/src/core/permissions/{permissionMap,routePermissionsRegistry}.ts`, `frontend/src/core/api/generated/*` |
| 6.5 | | <ul><li>New capture tool and sample. It covers every kind, the inbox routes and their 400, 401 and 404 answers, mentions and their refusals (outsider, department-bound, inactive), and the members list.</li><li>`_notes_flow.json` was recaptured, because the note shape gained `mentions`.</li></ul> | `docs/sync/tools/test_capture_notifications.py`, `docs/sync/samples/notifications/_notifications_flow.json`, `docs/sync/samples/production/_notes_flow.json` |
| 6.6 | | <ul><li>CONTRACTS: corrections, plus "Details settled while building RP-6".</li><li>PLAN status and corrections; DECISIONS phase row.</li><li>`docs/apps/notifications.md`; the pre-deploy checklist; CLAUDE.md installed apps; this report.</li></ul> | `docs/review-pipeline/`, `docs/apps/notifications.md`, `docs/07-deployment/pre-deploy-checklist.md`, `CLAUDE.md` |

**Tests changed:**
- `apps/core/tests/test_bootstrap.py`: production may have 9 migrations, notifications 1.
- `apps/core/tests/admin/test_admin_registry.py`: the `notifications` label.
- `apps/core/tests/test_dependency_direction.py`: no app imports notifications, and notifications reads production through its selectors only.
- Dead code removed: the three toast-store actions (section 0, item 4).

## 2. Evidence

| Check | Result |
|---|---|
| RP-6 tests (`apps/notifications/tests/test_rp6_notifications.py`) | **50 pass**, in these groups: <ul><li>notes: recipients, the author never told, a show-bound member, a narrowed author;</li><li>mentions: who is told, a mention winning, repeats, replies, edits that add or drop, reply edits, the refusals, the cap, a bounded query count;</li><li>tasks: create, `PATCH`, `bulk-assign/`, `bulk-create/` and `bulk-update/`; no row when nothing changes or for a self-assignment; status, and the RP-3 roll-up;</li><li>versions: the artist and the task's assignee, an artist without `version.view`;</li><li>review media: ready, failed, swept;</li><li>fan-out failure: the note is saved and the error logged;</li><li>inbox: live labels, own rows only, read, unread and the count, `before`, filters, a deleted target, lost reach (left the project, bound to a show, bound to a department, lost the code), the query count, 401;</li><li>retention.</li></ul> |
| Backend mutations | **24 of 25 caught; the other is equivalent.** The first run left three alive. Two new tests caught two of them: "a new thread forgets the versions' artists" (the existing test had the artist as the task's assignee too) and "notes without whole-project access" (only a narrowed author of the thread shows the difference). The third, the fan-out's `is_active` filter, is equivalent: the reach check refuses inactive users anyway. The caught mutants include: notify the actor; skip the reach check when writing, and when reading; read another person's rows; ignore `before`; drop `TaskAssigned` on create, update and bulk-assign; publish it when nothing changed; mention anyone; no cap; an edit notifying every mention; a fan-out error failing the request; replies forgetting earlier repliers; status changes forgetting the assignee; a purge keeping nothing; each missing `ReviewMediaFinished`; reach without the view code. |
| Backend suites, test database | Targeted: `apps/production` and `apps/notifications`: **1,857 pass**. After the three new tests (no backend source changed since), `apps/core` and `apps/notifications` again: **466 pass**. Both capture tools pass. The other apps did not run (targeted tests only); `manage.py test` was not used. |
| `ruff check` (changed files), `manage.py check`, `makemigrations --check` | clean |
| `ruff format` | new files formatted, by name; existing files keep their formatting |
| basedpyright (changed files) | **no new errors**. The 13 it reports are all in `apps/core/tests/test_bootstrap.py`, on lines this phase did not touch, and HEAD has the same 13. |
| OpenAPI | `manage.py spectacular` reports no warning for the new views. The regenerated schema and types only add the five routes. |
| Frontend: `pnpm typecheck`, `biome check src` (errors), `pnpm test`, `pnpm build`, `unreachable.mjs` | clean; 0 errors; **1,733 pass**; build passes; only tests, row keys and helpers unreached |
| Frontend mutations | **26 of 26 caught**: <ul><li>row links: the Media tab, a note on a shot, the failure reason;</li><li>`newestSeen` order; the panel loading before it opens;</li><li>the bell: read-all without a cutoff, a row not marked read, the panel staying open, no count in the label, Escape;</li><li>the page: read-all without a cutoff, read and unread swapped, the kind filter ignored;</li><li>the count path;</li><li>the picker offering department-bound members, members who left, or people already picked; no cap; known names forgotten;</li><li>an edit always sending mentions, or a new note never sending them; a reply dropping or keeping mentions; replies without mentions; an empty mention list sent;</li><li>`?tab=` ignored.</li></ul> |

## 3. Not done, or done differently

- **No live run.** Nothing ran the browser smoke or a live vitest file against a backend. The capture tool, which goes through the real routes, is the end-to-end evidence.
- **Polling, not push** (Q-RP-36 = A): a new row shows within a minute, or when the window regains focus.
- **No per-person preferences** (Q-RP-37 = A) and no e-mail (Q-RP-7 = A).
- **Every backend app ran in CI only.** Locally only `production`, `notifications` and `core` ran (targeted tests only). After the merge, CI on `develop` (`e5346727`, run 43430746885) ran every app: **7,393 pass**, and the frontend 1,733.
- **The toast history stays** in the store (section 0, item 4). Removing it would mean rewriting eight unrelated test files.

## 4. Before deploying

See `docs/07-deployment/pre-deploy-checklist.md`, "Next release, review-pipeline RP-6":
- two additive migrations;
- deploy the backend and the frontend together;
- restart the worker and beat for the daily purge.

No `init_platform` is needed.
