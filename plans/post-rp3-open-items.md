Status: PENDING – LATER FIX
Source: items left open by RP-3; follow-ups to RP-4
Blocked by: CR-52 (attachments only)

# Open items after the review pipeline (RP-1 to RP-27)

Written 2026-11-20, against `develop` at `6743b86b` (v4.24.0). Nothing here is built. This plan is meant to be picked up cold: every claim about the code below names the file it was read from, and each phase lists what to re-check before starting, because the code will have moved.

**How to use it.** The review pipeline's conventions still apply (`docs/review-pipeline/PLAN.md`, the rules at its top): pick one phase, turn it into a review-pipeline phase `RP-N` with its own section in `PLAN.md`, give its open questions `Q-RP-` numbers (the last one used is Q-RP-124), write a contract entry in `CONTRACTS.md` before code, and stop after the phase with a verification report. The phases here are a recommended order, not a commitment.

**Earlier decisions this plan touches.** Several items were left out on purpose, by a recorded answer. Picking one up means reversing or extending that answer, so each is listed under *Open questions* rather than assumed:

| Item | Earlier answer | Where |
|---|---|---|
| A review's approval approving its versions; roll-ups to the shot; Retake | "Not in RP-3" (no question asked) | `PLAN.md`, RP-3 |
| Someone else's queue | Q-RP-110 = A: `to_review=mine` only, so a client member cannot learn who reviews what | RP-24 |
| P3, HDR, 10-bit copies | Q-RP-70 = B: copies are sRGB, because browsers draw them as sRGB | RP-15, `transcode/colour.py:33` |
| Who downloaded, on the slate | Q-RP-114 = C | RP-25 |
| ALE or EDL export | Q-RP-121 = B, C not chosen | RP-27 |
| Leave-request notifications | Q-RP-62 = A: leave belongs to no project | RP-13 |
| Following a record | Q-RP-58 = A, "it can follow as following a record" | RP-13 |
| Version dependencies, deep walks, auto-revoke, renaming | "Not in RP-4"; Q-RP-19 = A (dependencies written once, at registration) | RP-4 |
| Keeping frames for good | Q-RP-73 = B (relevant to "frames about to expire") | RP-16 |
| Share links / account-free access | Q-RP-8 = B (relevant to CDN and object storage) | RP-7 |

---

## 1. What exists today, item by item

Status key: **Open** (nothing built), **Partly** (something adjacent exists), **Done** (no work left).

### 1.1 Reviews and approval

| Item | Status | What is there |
|---|---|---|
| Someone else's review queue | **Partly** | `GET versions/?to_review=mine` (`backend/apps/production/api/filtersets/version.py`, `filter_to_review`): versions in *Pending Review* on a live, non-archived task whose `reviewer` is the caller. Only `mine` is accepted (any other value is a 400). The Tasks list already filters by anyone's reviewer: `GET tasks/?reviewer_id=<id>` (`api/filtersets/task.py:32`), so an internal reader can already find whose tasks a supervisor reviews; what is missing is the *versions* waiting on someone else. Frontend: *To review: Mine* on `frontend/src/modules/production/review/versions.tsx`, *Reviewer: Me* on `frontend/src/modules/production/work/tasks.tsx`. |
| Versions with no reviewer; assignment rules | **Open** | A version's reviewer is its task's `Task.reviewer` (`models/task.py:85`, nullable). A version without a task (`Version.task`, nullable, `models/version.py:47`), or on a task with no reviewer, is waiting on nobody, and nothing lists it. There are no assignment rules: `TaskTemplate` (`models/task_template.py`) has no reviewer or assignee default, and `ProjectMembership` has only a free-text `department` (`models/project_membership.py:77`). |
| A version count on the Tasks list | **Open** | No task answer has a count (`api/serializers/task/list.py`; grep for `version_count` finds only deliveries). RP-26 added the Versions tab on a task (`frontend/src/modules/production/work/TaskWorkspace.tsx`) and `versions/?task_id=` (`api/filtersets/version.py`, `filter_task`). |
| Approving a review approves its versions | **Open** | A review moves through `ReviewService.change_status` and `record_verdict` (`services/review.py`). Its decision is one value for the whole review (`Review.status`, `supervisor_verdict`, `models/review.py:31-36`); participants give one verdict each, for the whole review (`ReviewParticipant.verdict`, `models/review_parts.py:63`). There is **no per-version verdict** inside a review (`ReviewItem` holds only `version` and `position`). Approving a review needs `review.approve`; approving a version needs `version.publish` and separation of duties (`constants/workflow.py:94-110`). |
| Roll-up task → shot | **Open** | RP-3's roll-up moves a task to *Approved* when a version is approved, behind `Project.approve_task_on_version_approval` (`services/approval_rollup.py`, `events/handlers.py` `ApprovalRollupHandler` on `StatusChanged`). Shot approval needs `shot.approve` (`constants/workflow.py:94`). Nothing rolls tasks up to the shot or asset. |
| Roll-up from Retake | **Open** | The RP-3 handler acts only on a version moving to *Approved*. RP-3's plan: "It can be added later as a second switch." |

### 1.2 Review copies

| Item | Status | What is there |
|---|---|---|
| A playlist or review as one zip | **Open** | One copy at a time: `review_media_links.py` (`download_name`, `download_path`, signed links with `REVIEW_MEDIA_LINK_TTL_SECONDS`) and `api/views/review_media_stream.py` (nginx `X-Accel-Redirect` under `MEDIA_ACCEL_PREFIX`, or a `FileResponse`). The downloaded file has its slate when the project asks (RP-25). Playlists hold versions through `PlaylistEntry` (`models/playlist_entry.py`); reviews through `ReviewItem`. |
| Display P3, HDR, 10-bit | **Open** | Every copy is 8-bit H.264 `yuv420p`, `libx264 -crf 20 -profile:v high` (`transcode/ffmpeg.py:281-283`, slate at `427-430`), for an sRGB display (`transcode/colour.py:33`, Q-RP-70 = B). OpenColorIO bakes the transform (`opencolorio>=2.6` in `backend/pyproject.toml`, ADR-0041). |
| With and without the grade, side by side | **Open** | The shot's grade (`Shot.grade`, RP-20) is baked into the one copy through a per-job LUT (`services/review_media.py` ~1457-1507, `colour.write_graded_lut`). There is one proxy per copy (`ReviewMedia.proxy_path`, `models/review_media.py:94`), so an ungraded picture does not exist to show. |
| Slates on stills | **Open** | Stills skip the slate (`services/review_media.py:1361`, `is_still`). |
| A studio-wide slate template or logo | **Open** | The slate is per project: `Project.review_slates` and `review_slate_note` (`models/project.py:107-114`); the lines are fixed in `_slate_lines` (`services/review_media.py:180`). No studio setting and no image. |
| Forensic or per-viewer watermarks | **Open** | Burn-ins are per project (`Project.review_burn_ins`), the same for every viewer. Q-RP-114 = C kept the downloader's name off the slate. |
| Object storage, CDN, adaptive streaming | **Open** | Review media lives on the media volume (`REVIEW_MEDIA_DIR = "review_media"`, `config/settings/components/storage.py:56`) and leaves through nginx `X-Accel-Redirect` after Django re-checks the signed link and the user (`review_media_stream.py:166`). ADR-0040 "Not decided here" lists object storage. No `django-storages` or `boto3` dependency. |

### 1.3 Grades

| Item | Status | What is there |
|---|---|---|
| Looks per sequence | **Open** | One look per project: `Project.review_look`, `review_view` (`models/project.py:83-84`); the shot's own grade on top (`Project.review_grades`). |
| FCPXML, AAF, OTIO | **Open** | Read today: `.cc`, `.ccc`, `.cdl` (`transcode/cdl.py`), CMX 3600 EDL and ALE (`transcode/grade_files.py`, `EXTENSIONS = (".edl", ".ale")`). No timeline library in `pyproject.toml`. |
| Export ALE, EDL, or a `.cdl` per shot | **Partly** | RP-27 exports one `.ccc` (`services/grade_export.py`, `cdl.write_collection`, `GET projects/{id}/grades/export/`, `shot.view`, one audit row per file). The scoping, ordering, audit row and frontend dialog (`frontend/src/modules/shots/components/GradeExport.tsx`) are reusable as they are. |

### 1.4 Notifications (in-app only)

The inbox has 20 kinds (`backend/apps/notifications/constants.py`), eight target types, a per-person mute list (`models/preference.py`), a fan-out that checks each recipient can open the record (`services/fanout.py`, `sources.py`), and scheduled jobs on Celery beat (`config/settings/components/celery.py`: purge, milestone reminders). **`Notification.project` is required** (`models/notification.py:33`).

| Item | Status | What is there |
|---|---|---|
| QC results | **Open** | `DeliveryQCCheck` (`apps/deliveries/models/qc.py`): `pass`, `fail`, `not_checked`, per delivery and item, grouped by `run_id`. Deliveries already notify on status (`DELIVERY_STATUS`). |
| Bookings | **Open** | `ResourceSchedule` (`apps/scheduling/models/__init__.py:319`): a resource, a time range, a status, an optional `task` (so a project through the task). `Resource.user` links a person. |
| Calendar events | **Open** | `CalendarEvent` (`scheduling/models/__init__.py:15`), `project` **nullable**. |
| Leave requests | **Open** | `ResourceLeave` (`scheduling/models/__init__.py:429`): no project, `approved_by`. Blocked by `Notification.project` being required (Q-RP-62). |
| Frames about to expire | **Open** | A sequence copy keeps its frames until `ReviewMedia.frames_until` (`REVIEW_MEDIA_SEQUENCE_KEEP_DAYS`, default 14), then `production.sweep_review_media` removes them. Nobody is told before. |
| Copies that differ | **Partly** | The project already lists them: `ReviewMediaSelector.differing(project)`, `remake_differing` (`services/review_media.py:638`), shown as a notice on the project. Nobody is notified. |
| Following a record | **Open** | Recipients come only from fields on the record (assignee, reviewer, creator, participants). |
| Digests | **Open** | Each event is its own row; no grouping or summary. |

### 1.5 Publishing (RP-4 follow-ups)

| Item | Status | What is there |
|---|---|---|
| Dependencies between versions | **Open** | Between **files** only: `PublishedFileDependency(downstream, upstream)` (`apps/publishing/models/dependency.py`), written at registration (`services/files.py:162-230`, `upstream_ids`, at most 50), same project, never edited (Q-RP-19). |
| Walking the graph more than one step | **Open** | `GET files/{id}/dependencies/` (`api/viewsets/file.py:182`) answers one step each way. |
| Revoking downstream files automatically | **Partly** | Revoking a file changes nothing downstream, by decision ("Revoking an upstream later changes nothing on the downstream"). It **does notify** the creators of the files built from it (`PublishedFileRevokedHandler`, `notifications/events/handlers.py:360`, kind `published_file_revoked`). |
| Renaming files to match a template | **Open** | `PublishPathTemplate` (`models/template.py`) checks a path at registration only, and only when `enforce` is on; `resolve-path` advises. "Changing a template does not move or flag old files." StudioHub never writes to studio storage (RP-17, RP-18). |

### 1.6 Attachments and cleanup

| Item | Status | What is there |
|---|---|---|
| Attachments on a version | **Blocked** | CR-52 (`docs/sync/backend-change-requests.md:982`) is **PROPOSED**: `Attachment` has no entity link. It proposes `entity_type` + `entity_id` on `Attachment`, filters, and a visibility rule that is a security decision for the owner. |
| Dead notification flags | **Partly** | `core/services/notifications.py` and the three `notification.*` **setting keys** were removed in RP-14 (WP 14.5, `rp-14-verification.md`). What remains are three **feature-flag constants**, `FeatureFlagCodes.NOTIFICATION_EMAIL`, `NOTIFICATION_SMS`, `NOTIFICATION_PUSH` (`notification_email`, `notification_sms`, `notification_push`; `apps/settings/constants/feature_flags.py:25-27`, and their entries in `ALL`). Checked 2026-11-20: nothing in `backend/` or `frontend/src/` reads them, nothing seeds them (no migration, fixture or `init_platform` line), and no captured sample contains them. `FeatureFlagCodes` itself is only re-exported (`apps/settings/constants/__init__.py`); no code reads any of its codes. The flags are not named `notification.*`: the task's wording comes from the old settings keys. |

---

## 2. Shared foundations and grouping

| Foundation | Items that use it | Built once in |
|---|---|---|
| **The `StatusChanged` roll-up handler pattern** (RP-3: per-project switch, own transaction, never raises, history row names the cause) | review → versions, task → shot, Retake | Phase 3 |
| **Who waits on a version** (`Task.reviewer`, `to_review`) | someone else's queue, versions with no reviewer, assignment rules | Phase 2 |
| **A per-version count / annotation on lists** | the Tasks list version count; later a "no reviewer" count | Phase 1 |
| **Recipients beyond the record's fields** (a follow table) and **project-less notifications** | following, digests, leave, calendar events without a project | Phase 4 |
| **Scheduled checks on Celery beat** (like `notifications.milestone_reminders`) | frames about to expire, copies that differ, digests | Phase 4 |
| **The grade writer and export route** (RP-27) | ALE, EDL, `.cdl` per shot | Phase 1 |
| **One copy per version, made by the worker** | zip download (reads copies), slates on stills, side by side (needs a second copy), P3/HDR (a second rendition), watermarks (per-viewer encode) | Phases 5 and 8 |
| **A timeline reader** | FCPXML, OTIO, AAF | Phase 6 |
| **The publishing dependency table** | version dependencies (derived), deep walks, auto-revoke | Phase 7 |

The notifications work and the review-queue work share **who a record waits on**: Phase 2's rules decide who a version waits on, and Phase 4's notifications tell them. Do Phase 2 before Phase 4, so the new notices reach the right person.

---

## 3. Phases

Recommended order: **1 → 2 → 3 → 4 → 5 → 6 → 7**, with **8** (infrastructure) as decisions and spikes only, and **CR-52** whenever the owner approves it. Phases 5, 6 and 7 do not depend on 2 to 4 and can move earlier if a studio asks.

Sizes: **S** ≤ 2 days, **M** ≈ a week, **L** > a week (backend, frontend, captures, docs and tests together, at this project's gates).

### Phase 1: Quick wins (cleanup, the version count, more grade exports)

**Re-check first:** `feature_flags.py` still unread (grep `FeatureFlagCodes`, `notification_email`); no `version_count` added since; `grade_export.py` unchanged.

| # | Item | Scope and approach | Data model / API | Frontend | RBAC | Migration / risk | Size |
|---|---|---|---|---|---|---|---|
| 1.1 | **Remove the dead notification flags** | Delete the three constants and their `ALL` entries, in their own commit, listed in the report. Before deleting, count `FeatureFlag` rows with those codes on the target databases (an admin could have created one by hand); a row left behind is harmless (nothing reads it), so no data migration. | None | None | None | None. Risk: none, if the re-check grep is empty. | S |
| 1.2 | **A version count on the Tasks list** | `version_count` on every task answer: live versions of the task, of those the caller reads (the same narrowing as the Versions list), annotated once per page, not one query per row. | New read-only field `version_count` (integer) on the task shapes; contract entry. Whole-shape tests and captured samples gain the key. | A *Versions* column on `work/tasks.tsx` (via `formatNumber`), linking to the task's Versions tab; the export gains the column. | `task.view` for the list as today. Counting only versions the caller reads (`version.view` + narrowing) is the safe default; see OQ-1. | None. Risk: query cost on big lists (a `Count` with a filtered subquery; check the plan on a large project). | S |
| 1.3 | **Export an EDL, an ALE, or a `.cdl` per shot** | Reuse RP-27's route and scoping with a `format` parameter: `ccc` (default, unchanged), `cdl_zip` (one `.cdl` per shot, zipped with stdlib `zipfile`), `edl`, `ale`. An EDL or ALE needs an event per shot, so it needs timing (a source timecode or an edit order) that StudioHub does not hold for every shot: this is a product question (OQ-2). The `.cdl` zip needs no timing and can go first. | `?format=` on `GET projects/{id}/grades/export/`; the audit row's `metadata.format`; contract update of C-RP-62. | A format choice in `GradeExport.tsx`. | `shot.view`, as today. | None. Risk: low; a round-trip test per format (export, import, all unchanged), as RP-27 did. | S (`.cdl` zip); M (EDL/ALE, once OQ-2 is answered) |

**Acceptance:** the flags are gone and every gate is green; a task row says how many versions it has, equal to its Versions tab's count for every role in the capture; each new export format imports back with every shot unchanged.
**Tests:** targeted backend (production, settings); query count on the task list independent of rows; capture tool per format; mutation checks (count ignores narrowing; count includes archived; zip missing a shot).

### Phase 2: Who a version waits on (someone else's queue, versions with no reviewer, assignment rules)

**Re-check first:** `filter_to_review` and `TaskFilterSet.reviewer_id`; whether `TaskTemplate` gained defaults; RP-24's decision record (Q-RP-110).

| # | Item | Scope and approach | Data model / API | Frontend | RBAC | Migration / risk | Size |
|---|---|---|---|---|---|---|---|
| 2.1 | **Someone else's queue** | Accept `to_review=<user id>` beside `mine`, for internal readers only. Q-RP-110 refused it to keep a client member from learning who reviews what; internal readers already see `reviewer_id` on every task, so the leak is only for external members. Option A: allowed to internal full members (no new code). Option B: a new code `version.view_review_queues` held by leads and up. (OQ-3.) | `to_review` gains a user id; external members get a 400 or an empty list (decide in the contract). | A reviewer picker next to *To review* on `review/versions.tsx` (the existing user picker); "Mine" stays the default. | A: `version.view` + not external. B: new `version.view_review_queues` (module `version`, action `view_review_queues`), granted in `init_platform`, permission-matrix test updated. | None. Risk: the visibility decision; get it in writing. | S |
| 2.2 | **Versions with no reviewer** | A filter `to_review=unassigned`: versions in *Pending Review* with no task, or on a task with no reviewer. Same narrowing as the list. | Filter value only. | A *To review: No reviewer* choice. | `version.view` (internal); external members get nothing (they read no tasks). | None. Risk: low. | S |
| 2.3 | **Assignment rules** | Who becomes a task's reviewer when none is set. Options: A: a default reviewer per task template (`TaskTemplate.default_reviewer`), applied when a task is made from the template. B: a per-project, per-department default reviewer. C: no rule; 2.2's list is the answer, and a lead assigns by hand from it. Recommend **C first, then A if asked** (OQ-4). No rules engine (Q-RP-5 = A stands). | A: one nullable FK on `TaskTemplate`, set on create only. B: a new small table (project, department, reviewer). | A: a reviewer field on the template form. B: a project settings section. | `tasktemplate.update` / `project.update` for setting it. | A or B: one additive migration (raise `apps/core/tests/test_bootstrap.py`'s production limit). Risk: a rule that silently assigns the wrong person; never overwrite a reviewer someone set. | S (C) / M (A or B) |

**Acceptance:** a lead lists a named supervisor's waiting versions (if allowed) and the versions waiting on nobody; a client or vendor member learns nothing new (capture proves it).
**Tests:** filter values, narrowing per role (full, show-bound, vendor, client), 400 on a bad value, query count; mutation checks on the external guard and the unassigned condition.

### Phase 3: Roll-ups (review → versions, task → shot, Retake)

**Re-check first:** `approval_rollup.py`, `ApprovalRollupHandler`; workflow tables in `constants/workflow.py`; RP-3's Q-RP-15 to Q-RP-18.

Each roll-up follows RP-3's proven shape: a per-project switch, default off, a `StatusChanged` handler, its own transaction, never raises, `StatusService.transition_status(enforce=False)`, a history row naming the cause. No rules engine.

| # | Item | Scope and approach | Data model / API | Frontend | RBAC | Migration / risk | Size |
|---|---|---|---|---|---|---|---|
| 3.1 | **Approving a review approves its versions** | When a review moves to *Approved*, its live versions (`ReviewItem`) move to *Approved*. The hard part is that a review has one decision, not one per version: approving a review of five versions would approve all five, including any the supervisor meant to reject. Options (OQ-5): A: all versions of the review. B: only versions with no open note or comment. C: first add a per-version decision inside a review (a field on `ReviewItem`), then roll up only the approved ones. Separation of duties: the review approver may be the producer of one of the versions; the roll-up must not bypass `check_separation` for that version (OQ-6). | A switch `Project.approve_versions_on_review_approval`. For C, `ReviewItem.decision` plus a route to set it. | The switch on the project form; for C, a per-version decision in `ReviewWorkspace.tsx`. | Approving a review: `review.approve`; whether that also counts as `version.publish` is OQ-6. | One additive migration (+1 for C). Risk: **high**, a bulk approval from one click; the RP-3 version → task roll-up then fires for each, so one review can approve many tasks. | M (A/B), L (C) |
| 3.2 | **Task → shot (and asset)** | When the last live, non-archived task of a shot reaches *Approved*, the shot moves to *Approved*. Options for "every task" (OQ-7): every task, or only tasks of chosen types/departments. | A switch `Project.approve_shot_on_tasks_approval`. | The switch; the shot's history shows the cause. | Shot approval normally needs `shot.approve`; the rule decides, as in RP-3 (record that in the contract). | One additive migration. Risk: medium; a task added later to an approved shot (decide: leave the shot alone, as Q-RP-16 = A did). | M |
| 3.3 | **Retake roll-up** | A version moving to *Retake* moves its task to *Retake* (the second switch RP-3 foresaw). Optionally the shot too (OQ-8). | A switch `Project.retake_task_on_version_retake`. | The switch. | As in RP-3: the approver's `version.publish` is the authority. | One additive migration (can share with 3.2's). Risk: an older version sent back retaking a task whose newer version is fine (Q-RP-18 = A counted any version; decide again for Retake, OQ-9). | S |

**Acceptance:** each switch off changes nothing on any route; on, each roll-up happens once, from the states allowed, with a history row naming the cause; a failure inside a roll-up never fails the original action.
**Tests:** RP-3's test list per roll-up (every route, every state, idempotent, failure forced); chains (review → version → task → shot) in one test; mutation checks as RP-3's.

### Phase 4: Notifications beyond the record (following, new sources, digests)

**Re-check first:** `notifications/constants.py` kinds; `Notification.project` still required; `fanout.py`; the beat schedule; Q-RP-58, Q-RP-62.

| # | Item | Scope and approach | Data model / API | Frontend | RBAC | Migration / risk | Size |
|---|---|---|---|---|---|---|---|
| 4.1 | **Following a record** (foundation) | A person follows a record (task, version, review, shot, delivery); followers are added to the fan-out of that record's existing kinds, still filtered by "can open it" (`sources.py`), still muteable. Unfollow is one call. | New `NotificationFollow(user, target_type, target_id, project, created_at)`, unique per pair; `GET/POST/DELETE notifications/follows/`. | A *Follow* toggle on the record pages; a *Following* list on the notifications page. | Any reader of the record (the fan-out re-checks reach). | One migration in `notifications`. Risk: volume on big shows; cap follows per user. | M |
| 4.2 | **QC results** | When a QC run finishes with a failure, tell the delivery's people (the RP-13 recipients) and its followers. One notice per run, not per check. | New kind `delivery_qc_failed`; needs a "run finished" event from `deliveries` (check whether a run has an end). | `describe.ts` gains the kind; the notice links to the delivery's QC tab. | Reach as `delivery.view`. | None (kind is a choice). Risk: low. | S |
| 4.3 | **Bookings** | A booking created, moved or cancelled tells the booked person (`Resource.user`). Project from the booking's task; a booking without a task has no project, so it waits for 4.6. | Kind `booking_changed`, target type `booking`; reach and labels in `scheduling/selectors/notification_sources.py`. | The kind; link to the schedule. | Reach: whoever reads the booking. | None. Risk: noisy edits; notify on create, time change and cancel only. | S |
| 4.4 | **Calendar events** | An event with a project tells its attendees (check the model's attendee field before planning detail); events without a project wait for 4.6. | Kind `calendar_event`, target type `calendar_event`. | The kind. | Reach as the event's read. | None. | S |
| 4.5 | **Frames about to expire; copies that differ** | A daily beat job: copies whose `frames_until` is within N days (OQ-10) tell the copy's maker once; a project that gains differing copies tells (OQ-11: whom; the person who changed the settings is the natural one). One notice per project per day, not per copy. | Kinds `review_frames_expiring`, `review_copies_differ`; target `version` / `project` (a new `project` target type). | The kinds; links to the version's media and the project's notice. | Reach as the version / project. | None. Risk: low. | S |
| 4.6 | **Project-less notifications; leave requests** | Make `Notification.project` nullable; define reach for project-less targets (leave: the requester and whoever may approve leave). Reverses the reason Q-RP-62 gave; needs a decision on who approves leave (OQ-12). | Migration: `project` null; the inbox's project filter must treat null; target type `leave`. | The kind; a link to the leave page. | Leave approvers: the scheduling app's approve code (check). | One migration on a large table (null is a metadata-only change on PostgreSQL). Risk: medium; every inbox query that joins the project. | M |
| 4.7 | **Digests (in-app)** | A daily (or per-session) summary row in the inbox: "12 updates on SH0010 since yesterday", grouping a person's unread rows by record, and optionally muting the individual rows for those kinds (OQ-13). In-app only; no e-mail. | `NotificationPreference` gains `digest_kinds` (a list, like `muted_kinds`); a beat job writes a `digest` kind row with the grouped targets in a JSON payload. | A digest row in the inbox that expands; preferences gain a "Group these into a daily digest" choice per kind. | Own notifications only. | One migration. Risk: medium; correctness of "what was already seen". | M |

**Acceptance:** every new notice reaches only people who can open the record (capture per role); muting and following behave per kind; the digest never shows a row the person could not open.
**Tests:** fan-out tests per kind; reach tests per role (internal, show-bound, vendor, client); beat jobs run twice give one notice; mutation checks on reach and the once-only rule.

### Phase 5: Review copies, without new infrastructure

**Re-check first:** `review_media.py` slate and grade paths; `review_media_links.py`; `PlaylistEntry`, `ReviewItem`.

| # | Item | Scope and approach | Data model / API | Frontend | RBAC | Migration / risk | Size |
|---|---|---|---|---|---|---|---|
| 5.1 | **A playlist or review as one zip** | A worker job builds a zip (stdlib `zipfile`, stored, not compressed: movies do not compress) of the ready copies of the playlist's or review's versions, each the slated file RP-25 serves, plus a plain manifest; the person is told when it is ready (a new kind) and downloads it through the existing signed-link route. Copies the person cannot read are left out. Size cap from a setting. | `POST playlists/{id}/download/`, `POST reviews/{id}/download/` → a job; `GET` its state; the zip on the media volume under the project, swept like other media. | A *Download all* action on the playlist and review pages; the notice links to the file. | `playlist.view` / `review.view`, plus `version.view` per copy; external members get their reachable versions only (decide, OQ-14). | One small table for the job (or reuse `ReviewMedia` with a new kind: decide while building). Risk: disk use; cap and sweep. | M |
| 5.2 | **Slates on stills** | A still's download gains a slate image beside it (a second frame in the file is not possible for a still): options A: a two-page PDF / a zip of slate + still; B: the slate burned into a border (OQ-15). | `probe.slate` for stills; the download route unchanged. | None beyond the existing download. | As today. | None. Risk: low. | S |
| 5.3 | **A studio-wide slate template or logo** | A studio setting for the slate's extra line and an uploaded logo (PNG), with the project's own line still winning. The logo goes through the existing attachment upload limits. | Studio settings (`apps/settings`) for the line; the logo file on the media volume; the worker reads it. | A settings section with an image upload and a preview. | `settings.update` (check the code), or the studio admin role. | Possibly one migration. Risk: a logo makes every slate depend on one file; fall back to no logo. | M |
| 5.4 | **With and without the grade, side by side** | Make an ungraded copy as well, when the project bakes grades (doubles encode time and disk for graded copies only), and a player mode that plays both in sync. Option B: only on request per version (OQ-16). | `ReviewMedia.ungraded_proxy_path` (or a second row with a `variant`); the stream route takes `variant=ungraded`. | A split / wipe view in `ReviewViewer.tsx` and `VersionMedia.tsx`, synced by frame. | `version.view`. | One migration. Risk: medium; disk and the player's sync. | M–L |

**Acceptance:** a zip holds exactly the copies the person may read, each slated as its single download would be; stills carry their slate; the side-by-side view plays both in frame sync.
**Tests:** worker tests on the test database with small fixtures; signed link reach; sweep removes zips; live run for the zip download.

### Phase 6: Timeline formats and looks per sequence

**Re-check first:** `grade_files.py` and `grade_import.py` (the import pipeline these plug into); whether a timeline library has been added.

| # | Item | Scope and approach | Data model / API | Frontend | RBAC | Migration / risk | Size |
|---|---|---|---|---|---|---|---|
| 6.1 | **FCPXML** | Read with stdlib `xml.etree.ElementTree` (as `cdl.py` does), defused for external entities as the CDL reader is. Map clips to shot names as the EDL reader does (Q-RP-101's name order). Grades in FCPXML are effect parameters, not ASC CDL, in most exports: check real files first (OQ-17); if they carry no CDL, the format is only useful for names, not grades. | The import route accepts `.fcpxml`. | The import dialog's accepted types. | `shot.update`, as the import. | None. Risk: the format may hold no usable grade. | M |
| 6.2 | **OTIO** | `.otio` is JSON: it can be read with stdlib `json` for clip names and metadata, but the schema is versioned; the `opentimelineio` library handles that and is the reference reader. Justification for the dependency only if OTIO and AAF are both wanted (6.3 needs it). Grades live in clip metadata, which varies by tool (check samples). | `.otio` accepted. | As 6.1. | As 6.1. | None. Risk: dependency size; metadata conventions. | M |
| 6.3 | **AAF** | Needs a binary reader: the OTIO AAF adapter (`otio-aaf-adapter`, which uses `pyaaf2`). Two new dependencies; recommend **only if a studio has AAFs with CDL in them** (OQ-18). | `.aaf` accepted. | As 6.1. | As 6.1. | None. Risk: dependencies, file size limits. | M |
| 6.4 | **Looks per sequence** | `Sequence.review_look` (blank = the project's look), used when a copy of a shot in that sequence is made; changing it makes those copies "differ" like a project setting change does (RP-16's machinery). | One nullable field on `Sequence`; in the sequence shape; contract. | A look picker on the sequence form (options from the colour config, as the project form). | `sequence.update`. | One migration. Risk: the "differing" computation must include it (`ReviewMediaSelector.differing`). | M |

**Acceptance:** each new format imports real sample files with the same dry-run report RP-22 gives; a sequence's look reaches its shots' new copies and marks old ones as differing.

### Phase 7: Publishing depth

**Re-check first:** `publishing/models/dependency.py`, `services/files.py`, `api/viewsets/file.py`; `docs/publishing/CONTRACTS.md` (DOM-PUB-07).

| # | Item | Scope and approach | Data model / API | Frontend | RBAC | Migration / risk | Size |
|---|---|---|---|---|---|---|---|
| 7.1 | **Walk more than one step** | `GET files/{id}/dependencies/?depth=N` (max e.g. 10) and `direction=up|down`, a breadth-first walk with a bounded number of queries (one per level) or a PostgreSQL recursive CTE (keep ORM portability in mind: CLAUDE.md asks for portable code, so prefer the per-level loop). Cycles cannot form (Q-RP-19), but guard anyway with a seen-set. Same reach as the file read. | Query params on the existing route; contract update (API-PUB-*). | The file page's dependency panel gains "show all upstream / downstream", as a tree. | `publishing.view`. | None. Risk: large graphs; cap nodes per answer. | S–M |
| 7.2 | **Dependencies between versions** | Derive, do not store: version B depends on version A when a file of B has an upstream file of A. A read route `GET versions/{id}/dependencies/` built from the file table; no new table, no new write path, so Q-RP-19 holds. (OQ-19: whether a hand-entered version dependency without files is wanted; that would be a new table and reverse Q-RP-19.) | Read-only route. | The version page shows the versions it was built from and into. | `publishing.view` + `version.view`. | None. Risk: low. | S |
| 7.3 | **Revoke downstream automatically** | Option A: a per-project switch: revoking a file also marks its downstream files (and theirs, through 7.1) as *Deprecated*, never *Revoked* (a deprecation is reversible). Option B: a "revoke with dependents" choice on the revoke action, listing what will change first (a dry run). Recommend **B** (OQ-20): an explicit, previewed act. The existing notice already tells the downstream creators. | `POST files/{id}/revoke/` gains `cascade` and `dry_run`. | The revoke dialog lists the affected files before confirming. | `publishing.revoke` for the file **and** each downstream file (no widening). | None. Risk: **high** if automatic; a cascade across a show. | M |
| 7.4 | **Rename files to match a template** | StudioHub does not write to studio storage (RP-17/18), so it cannot move files. Recommend a **report, not a rename**: `GET publishing/templates/{id}/mismatches/` lists registered files whose path does not match, for a pipeline tool to move and re-register. Moving files from the server is a security and operations decision (OQ-21) and is not planned. | A read route. | A mismatch list on the template page, with export. | `publishing.template.manage`. | None. Risk: low (read only). | S |

**Acceptance:** deep walks match a hand-built graph in tests, within the query bound; a cascade revoke never touches a file the actor could not revoke; the mismatch report matches `resolve-path` for every file.

### Phase 8: Infrastructure-heavy items (decide, then spike)

None of these should be built without the product decision in section 5 and a spike on real studio media. Each is listed with options, trade-offs and a recommendation, including whether it is worth doing at all.

**8.1 Object storage for review media.**
- A: keep the media volume (today). Simple, nginx serves ranges, Django re-checks every use. Limit: one host's disk.
- B: `django-storages` + S3-compatible bucket, served by **presigned URLs**. New dependencies (`django-storages`, `boto3`). A presigned URL cannot re-check the user on each use, which weakens the RP-5 model (every use names and re-checks a signed-in user; Q-RP-8 = B, no account-free links). Short expiry narrows it but does not close it.
- C: bucket behind nginx: Django re-checks, then `X-Accel-Redirect` to an internal nginx location that proxies the bucket. Keeps today's trust model and range support; one more hop.
- **Recommendation: not now. When a host's disk is the limit, do C**, not B. Worth doing only at that point. Size: L.

**8.2 CDN.** Every play is per user and re-checked; a CDN only helps when many people in many places watch the same bytes, and caching per-user, signed responses defeats it. **Recommendation: not worth it** for internal review. Revisit only for remote vendors at scale, after 8.1 C. Size: L.

**8.3 Adaptive streaming (HLS/DASH).** Review needs frame-accurate stepping and seeking; segmenting into HLS makes that harder in a browser, multiplies storage (several renditions), and adds a packaging step to every copy. Copies are already web-sized H.264. **Recommendation: not worth it.** If remote viewers struggle, a lower-bitrate second rendition is simpler (see *Suggestions*). Size: L.

**8.4 Display P3, HDR, 10-bit copies.**
- Browser playback of P3 and HDR video depends on the browser, OS and display; 10-bit needs HEVC Main10 or AV1 10-bit, whose browser decoding varies by platform. H.264 High 10 is not decoded by mainstream browsers.
- A: no change (sRGB, 8-bit; Q-RP-70 = B). B: an optional **P3 8-bit** second rendition tagged for P3 (OCIO already has the displays), shown only when the browser reports a P3 screen (`color-gamut: p3`). C: HDR (PQ/HLG) copies in HEVC or AV1, for HDR review rooms.
- **Recommendation: A, unless the studio reviews on calibrated P3 displays in a browser; then a spike for B on the studio's actual machines. C is not worth it in a browser;** HDR review belongs in a grading suite. Size: B M–L, C L.

**8.5 Forensic or per-viewer watermarks.**
- A: a **visible per-viewer burn-in on downloads only** (name, time), made at download time by the worker. Cost: one encode per download; the download becomes a job (like 5.1). Reverses Q-RP-114 = C.
- B: a visible per-viewer overlay in the **player** (CSS over the video). Cheap, no encode; trivially removed by a screen recorder, so a deterrent, not forensic.
- C: **invisible forensic** watermarking: a commercial vendor SDK and licence (a new external dependency and contract).
- **Recommendation: B for playback if leaks are a concern, A for downloads if clients receive files; C only if a studio's client contract requires it.** Size: A M, B S, C L.

### Blocked: attachments on a version (CR-52)

**Blocked until the owner approves CR-52**, because its visibility rule ("an attachment of a record is listed to everyone who may see the record") widens who sees a file, which is a security decision. Once approved: the backend diff in CR-52 (two fields, filters, visibility), then an *Attachments* tab on version, review, shot and asset pages using the existing `ApiClient.upload`. Size: M.

**What can proceed without CR-52:** everything in Phases 1 to 8. None of them reads or writes attachments. The only soft link is 5.3 (a slate logo upload): store the logo as a studio setting file on the media volume, not as an `Attachment`, so it does not wait on CR-52.

---

## 4. Quick wins vs. big bets

| Quick wins (S, low risk) | Big bets (M–L, decision first) |
|---|---|
| 1.1 Dead flags removed | 3.1 Review approves its versions |
| 1.2 Version count on the Tasks list | 4.6 Project-less notifications (leave) |
| 1.3 `.cdl` per shot (zip) | 4.7 Digests |
| 2.2 Versions with no reviewer | 5.4 Graded / ungraded side by side |
| 2.1 Someone else's queue (once OQ-3 is answered) | 7.3 Cascade revoke |
| 3.3 Retake roll-up | 8.x Object storage, CDN, ABR, P3/HDR, watermarks |
| 4.2–4.5 New notification sources | 6.2–6.3 OTIO, AAF (new dependencies) |
| 7.1 Deep walk, 7.2 Version dependencies, 7.4 Mismatch report | |

---

## 5. Open questions (product decisions; not guessed)

| ID | Question | Blocks |
|---|---|---|
| OQ-1 | Does a task's version count count all its versions, or only those the reader may open? | 1.2 |
| OQ-2 | For an EDL or ALE export, where does each shot's timing (record and source timecode, edit order) come from? StudioHub does not hold an edit for every shot. | 1.3 (EDL, ALE) |
| OQ-3 | Who may see someone else's review queue: every internal full member, or only holders of a new code? (Reverses Q-RP-110 for internal readers.) | 2.1 |
| OQ-4 | Are assignment rules wanted at all, or is a "no reviewer" list enough? If wanted: per task template or per project and department? | 2.3 |
| OQ-5 | When a review is approved, which of its versions are approved: all, those without open notes, or only ones given a per-version approval inside the review? | 3.1 |
| OQ-6 | Does approving a review count as approving each version (`version.publish`, separation of duties), or must each version still pass its own checks? | 3.1 |
| OQ-7 | Task → shot: every live task of the shot, or only tasks of chosen types or departments? What happens when a task is added to an approved shot? | 3.2 |
| OQ-8 | Does a Retake roll on from the task to the shot? | 3.3 |
| OQ-9 | Does a Retake of an **older** version retake the task? | 3.3 |
| OQ-10 | How many days before frames expire is someone told, and who: the copy's maker, the version's artist, or followers? | 4.5 |
| OQ-11 | Who is told that a project's copies differ from its settings? | 4.5 |
| OQ-12 | Who approves leave across the studio, and should they be notified of every request? (Reverses Q-RP-62.) | 4.6 |
| OQ-13 | Do digests replace the individual rows for the chosen kinds, or sit beside them? Daily at what time, in whose time zone? | 4.7 |
| OQ-14 | Can a client or vendor member download a review's zip (of the versions they reach)? | 5.1 |
| OQ-15 | A still's slate: a separate image in a zip, or burned into a border? | 5.2 |
| OQ-16 | Ungraded copies: made for every graded copy, or only on request? | 5.4 |
| OQ-17 | Do the studio's FCPXML exports carry ASC CDL values at all? (Needs real files.) | 6.1 |
| OQ-18 | Does any studio send AAFs with grades? If not, drop 6.3. | 6.3 |
| OQ-19 | Is a hand-entered version dependency (without files) wanted? (Would reverse Q-RP-19.) | 7.2 |
| OQ-20 | Cascade revoke: automatic per project, or an explicit, previewed choice on each revoke? And deprecate or revoke the dependents? | 7.3 |
| OQ-21 | May the server ever move files on studio storage? (Today it never writes there.) | 7.4 |
| OQ-22 | Is any of 8.1–8.5 needed in the next year, and which studio requirement drives it (disk size, remote vendors, P3 rooms, a client's contract)? | 8.x |
| OQ-23 | CR-52: is the visibility rule (everyone who sees the record sees its attachments) acceptable? | Attachments |

---

## 6. Test strategy (all phases)

- **Backend:** targeted pytest runs only (the touched apps plus `apps/core/tests/test_bootstrap.py`), on the pytest test database, never the development database; no `manage.py test`. Query-count tests for every list change. A capture tool per phase under `docs/sync/tools/` writing real responses to `docs/sync/samples/` for every role that matters (full, show-bound, department-bound, vendor, client, a role without the code, an outsider).
- **Frontend:** tests from captured samples only (`loadSample`, `mockFetch`), no hand-written shapes; numbers and dates through `formatNumber` / `formatDateTime`; typecheck, Biome (0 errors, the warning baseline), build, `unreachable.mjs`.
- **Live:** one `run_role_smoke.sh --vitest <file>` run per phase, against a throwaway backend, one at a time.
- **Mutation checks** on the tests that matter in each phase (listed per phase above), each file restored and byte-compared.
- **Gates:** `ruff check`, `ruff format` on new files only, `manage.py check`, `makemigrations --check`, basedpyright with no new errors in changed files, CI green after the merge.

---

## Suggestions (not in the list; for the owner to accept or drop)

- **Remove the whole of `FeatureFlagCodes`.** No code reads any of its codes (RP-5 found the same for the media flags), so the other 26 are as dead as the notification three. Its own commit, after 1.1.
- **A lower-bitrate rendition for remote viewers**, instead of adaptive streaming (8.3), if remote review is slow.
- **A count of what waits for me** in the sidebar (Q-RP-112 B), which becomes cheaper once Phase 2's filters exist.
- **RP-21's capture creates General tasks** (it sends `shot`, which the task form ignores; noted in `rp-27-verification.md`). Fix the capture so its tasks are on the shot, before Phase 2 relies on it.

---

## One-page summary

**Phases, in order**

1. **Quick wins** (S each): remove the three dead `notification_*` feature-flag constants; a version count on the Tasks list; a `.cdl` per shot export (EDL/ALE once timing is decided).
2. **Who a version waits on** (S–M): someone else's queue, versions with no reviewer, optional assignment rules.
3. **Roll-ups** (M): Retake → task, task → shot, review → versions, each a per-project switch in RP-3's pattern. The review roll-up needs the most decisions.
4. **Notifications** (M): following a record first, then QC, bookings, calendar events, expiring frames and differing copies; then project-less notifications (leave) and in-app digests.
5. **Review copies on today's infrastructure** (M): zip download of a playlist or review, slates on stills, a studio slate template or logo, graded/ungraded side by side.
6. **Timeline formats** (M): FCPXML (stdlib), OTIO and AAF (new dependencies, only if real files need them), looks per sequence.
7. **Publishing depth** (S–M): deep walks, derived version dependencies, previewed cascade revoke, a template mismatch report instead of renaming.
8. **Infrastructure** (decide first): object storage (later, behind nginx), CDN and adaptive streaming (not worth it), P3/HDR/10-bit (only for calibrated P3 rooms), watermarks (player overlay or download burn-in).

**Blocked:** attachments on a version, until CR-52 is approved. Nothing else depends on it.

**Already done or partly done:** `core/services/notifications.py` and the `notification.*` setting keys (removed in RP-14); a reviewer filter on tasks (RP-24); notices to downstream creators when a file is revoked (RP-13); a project list of differing copies (RP-16); `.ccc` grade export (RP-27).

**The first three tasks**

1. **Remove `NOTIFICATION_EMAIL`, `NOTIFICATION_SMS`, `NOTIFICATION_PUSH`** from `backend/apps/settings/constants/feature_flags.py` (and `ALL`), after re-running the grep and counting `FeatureFlag` rows with those codes. Own commit.
2. **Add `version_count` to the task shapes**, annotated once per page with the caller's narrowing, plus the Tasks list column and export column; contract, captures, query-count test. Answer OQ-1 first.
3. **Add `?format=cdl_zip` to the grade export**, reusing RP-27's scoping and audit row, with a round-trip test; ask OQ-2 in the same phase so EDL/ALE can follow.
