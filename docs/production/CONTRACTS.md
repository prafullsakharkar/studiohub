# Production API contract changes

Every change to a URL, field, status code or permission that a client can observe is recorded here, per phase of `PLAN.md` §4. Same pattern as `docs/identity/CONTRACTS.md`. Branch: `feature/production-hardening`.

## Phase 1 — authorization hot fixes (WP A1, A5, A7)

| ID | Endpoint | Before | After | Client impact |
|---|---|---|---|---|
| C-01 | `GET/POST /api/v1/automations/rules/`, `GET/PATCH/PUT/DELETE /api/v1/automations/rules/{id}/`, `GET /api/v1/automations/audit-logs/` | Any authenticated user could read, create, change and delete every project's rules and read every execution log (F-C1). | Needs `automation.view` (GET), `automation.create` (POST), `automation.update` (PATCH/PUT), `automation.delete` (DELETE) **and** an active membership of the rule's project. A rule outside the caller's projects answers **404**, exactly like an unknown id. Rules without a project (platform-global) are visible and writable by platform admins only. | A user without the codes gets 403 (was 200). Lists shrink to member projects. |
| C-01a | `POST /api/v1/automations/rules/` | `project` came only from `workflow_id`. | New optional body field `project_id` (UUID, code or mock id). A project is **required** unless the caller is a platform admin or `workflow_id` resolves to a workflow that has one. A project the caller cannot use and an unknown project give the same **400** `{"project_id": ["Unknown project."]}`; a missing project gives `{"project_id": ["A project is required."]}`. | Clients that created rules without a project must send `project_id`. |
| C-01b | `workflow_id` on rules | Resolved globally; any workflow could be linked. | Resolved inside the caller's projects and, when the rule has a project, inside that project. Unknown, foreign and wrong-project workflows give **400** `{"workflow_id": ["Unknown workflow."]}`. Non-UUID values (`wf-001`) are still ignored, as before. | none for valid input |
| C-02 | `/api/organizations/projects/{project}/{members,summary,dashboard,sequences,shots,tasks,assets,versions,reviews,editorial,notes,deliveries,schedule,resources,pipeline,files,activity}` | Membership only. A non-member got **403**, an unknown project 404, which confirmed that a project exists (F-M12). | Needs the permission code of the matching flat endpoint (below) **and** membership. The code is checked first and does not depend on the project. A non-member and an unknown project both answer **404**. | Non-member 403 → 404. Callers without a code get 403 (was 200). |
| C-02a | `POST .../notes` | Any member. | Needs `note.create`. | |
| C-02b | `POST .../members` | Platform admin only. | Unchanged, plus the `project.update` code. | none for admins |
| C-03 | Role catalog (`manage.py init_platform`) | `sequence.view`, `version.view`, `media.view` were enforced by the flat endpoints but granted to no seeded role. | Added to the catalog and granted to every seeded production role. New: `automation.{view,create,update,delete}` (production-admin, vfx-supervisor, org-admin) and `note.create` (all production roles). | **Run `uv run python manage.py init_platform` on every database after deploying.** It only adds missing rows; role edits made since are kept. Until then non-admin users get 403 on automation and notes. |
| C-04 | `GET /api/v1/analytics/kpis/`, `GET /api/v1/analytics/departments/` | Counted every project for any authenticated user (F-M13). | Counts only the caller's member projects. Platform admins and superusers still count everything. | Dashboards of non-admins show smaller numbers. No permission code is added (`analytics.view` is not seeded). |
| C-05 | `episode_id` on shot create/update | Resolved by code across **all** projects, so `EP101` could match another project's episode (F-H6). | Resolved inside the shot's project. A foreign or unknown episode gives the same **400** `{"episode_id": ["Unknown episode."]}` (the message "Episode does not belong to the selected project." is gone). | none for valid input |
| C-05a | `GET /api/v1/shots/?episode_id=` | Resolved to one global episode, then filtered. | Matches by id or code (case-insensitive, mock id `ep-101` supported) among the shots the caller can see. `EP101` returns one shot set per visible project; combine with `project_id` to narrow. Unknown values return an empty list. | Lists without `project_id` now include every visible project's `EP101`. |

### Permission code per nested route (GET)

| Route | Code | Route | Code |
|---|---|---|---|
| members, summary, dashboard, pipeline, notes | `project.view` | sequences | `sequence.view` |
| shots | `shot.view` | tasks, resources | `task.view` |
| assets | `asset.view` | versions | `version.view` |
| reviews | `review.view` | editorial | `track.view` |
| deliveries | `delivery.view` | files | `media.view` |
| activity | `audit.view` | schedule | `schedule.view` |

### Frontend change list

1. Send `project_id` when creating an automation rule.
2. Treat 404 on `/api/organizations/projects/{project}/...` as "no access or unknown" (it used to be 403 for non-members).
3. Expect smaller analytics numbers for non-admin users.

## Phase 2 — write-path integrity (WP A2, A3, A8, G2)

Decisions behind this phase: Q13 = **400** for fields that now have a dedicated action. For `status` and `pipeline` the plan locked the field, but no action exists yet to move a shot or version through its non-approval statuses (that is P3/D4). The owner chose to **guard the privileged value instead of locking the field**, so no frontend flow breaks before P3. `client_approved` is guarded the same way because it has no action either.

| ID | Endpoint | Before | After | Client impact |
|---|---|---|---|---|
| C-06 | Create/update of Shot, Version, Review, Task (and bulk-update) | `supervisor_approved`, `is_published`, `is_hero`, `supervisor_verdict`, `is_archived`, `logged_hours` could be written by anyone holding `*.update`/`*.create` (F-H1). | Sending one with a value different from the stored one (on create: different from the default) is **400** `{"<field>": ["Cannot be set directly. <hint>"]}`. Echoing the stored value, as a full PUT does, is accepted and ignored. Fields stay in responses. Dedicated paths: shot `approve`; version `publish`/`unpublish`/`promote`; review `verdict`; task `archive`/`restore`; `logged_hours` has none until the timelog rollup (P3/F2). | Clients that PATCH these fields get 400; use the action. |
| C-07 | Create/update of Shot, Version, Review, Timelog (and bulk-update) | `status` and Shot `pipeline`/`client_approved` writable by anyone holding `*.update`. | Setting, or moving away from, a privileged value needs its code on top of `*.update`/`*.create`; otherwise **403** `Changing <field> to or from '<value>' requires <code>.` Shot `status`/`pipeline` step `Approved` and `client_approved=true`: `shot.approve`. Version `status=Approved`: `version.publish`. Review `status` in Approved, Rejected, Changes Requested, Retake: `review.approve`. Timelog `status` in Approved, Rejected: `timelog.approve`. In bulk-update the item reports `invalid` with `{"detail": ...}`. | Ordinary status changes still work. Approvals need the approve code. |
| C-08 | `POST /versions/` | `shot`, `asset`, `task`, `artist` accepted any record (F-H2). | The record must belong to the version's project (artist: active member). Unknown, foreign and cross-project ids give the same **400** `{"<field>": ["Unknown <label>."]}`. | none for valid input |
| C-08a | `POST /timelogs/` | Task resolved among all projects, including by `task_code`; `person` could be anyone (F-H4). | Tasks resolve only among the caller's member projects and the project comes from the task. `person` must be the caller unless the caller holds the new `timelog.manage` (**403**), and then must be a project member (**400**). | Logging for others needs `timelog.manage`. |
| C-08b | `POST /timelogs/{id}/approve/`, `/reject/` | Anyone with `timelog.approve`, including on their own log. | **403** when the caller is the timelog's person (superusers excepted). | A second approver is needed. |
| C-08c | `POST /versions/{id}/add-to-playlist/` | `Playlist.objects.get` unscoped, errors swallowed (F-H8). | Needs `version.update` **and** `playlist.update`. The playlist must belong to the version's project, else **400** `{"playlist_id": ["Unknown playlist."]}`. Both JSON writes happen in one transaction and nothing is swallowed. | none for valid input |
| C-08d | `POST /playlists/{id}/add-entry/`, `/reorder/` | Entries stored as sent, including `id`/`item_order` and any `version_id`. | `version_id` must be a version of the playlist's project (**400**). `id` and `item_order` are assigned by the server. `reorder` only arranges entries the playlist already has (**400** `{"entries": ["Unknown entry."]}` otherwise) and renumbers `item_order`; other keys sent in `entries` are ignored. | Clients must not use reorder to edit entries. |
| C-08e | Task create/update, `POST /tasks/bulk-assign/` | `assignee`/`reviewer` any user; bulk-assign checked the wrong project set (F-M3). | Assignee and reviewer must be active members of the task's project (platform admins pass). Bulk-assign checks the assignee against the project of every selected task and changes nothing otherwise (**400**). | none for valid input |
| C-09 | Bodies of custom actions (G2): task `bulk-assign`, `bulk-status`, `bulk-delete`; version `publish`, `add-to-playlist`; timelog `reject`; playlist `add-entry`, `remove-entry`, `reorder`, `share`; review `submit`, `start-review`, `approve`, `reject`, `request-changes`, `close`, `verdict`, `annotations`, `comments`, `notes`, `participant-verdict`; `POST /scheduling/resolve-overbooking/` | Read with `request.data.get(...)`; unknown keys merged into stored JSON or ignored. | Validated by `api/serializers/actions.py` and shown in OpenAPI. Closed bodies reject undeclared keys with **400** `{"<key>": ["Unknown field."]}`. Free-form blobs (publishing info, playlist entries, share settings) type their known keys and keep the rest. `task_ids`/`assignee_id`/`team_id`/`playlist_id` must be UUIDs. A missing `status` on `bulk-status` is now `{"status": ["This field is required."]}` (was `{"detail": "status is required."}`). | Clients sending extra keys to these actions get 400. |
| C-10 | `POST .../bulk-update/` on shots, assets, tasks, sequences, episodes | Items validated by the update serializer only. | Items also pass the reference checks and privileged-value guard of C-06 to C-08; a rejected item reports `invalid`. | none for valid input |

Other changes with no client-visible effect: the unrouted scheduling stub views (events, resources, holidays, leaves) are deleted; `DummySerializer` is gone; `BulkOperationService.bulk_update` takes a `validate` callable instead of importing API serializers; the unused `ProductionEntityModel` base class is deleted (`Project` extends `EntityModel`; no migration).

### Seed (extends C-03)

`timelog.manage` is added to the catalog and to production-admin, vfx-supervisor and org-admin. Re-run `uv run python manage.py init_platform`. The other `timelog.*` codes are still not seeded to any role (see the open note in the P2 report).

### Frontend change list (adds to Phase 1)

4. Stop sending `supervisor_approved`, `is_published`, `is_hero`, `supervisor_verdict`, `is_archived`, `logged_hours` on create/update; call the action. A full PUT that echoes stored values is fine.
5. Approvals (`status: "Approved"`, `client_approved`) through PATCH now need the approve code; show the 403 message.
6. Do not rely on `playlists/{id}/reorder/` to edit entries.
7. Remove unknown keys from the action bodies listed in C-09.

## Phase 3 — services first (WP A4, A6, D4, D5, F2)

Decisions behind this phase: Q17 = **yes** (the generic bulk whitelist in `apps/core` and change tracking in `apps/audit` may change). Q7 (fixed maps or per-project status lists) and Q14 (creator's role) are unanswered; this phase uses the plan's MVP defaults and says so below.

| ID | Endpoint | Before | After | Client impact |
|---|---|---|---|---|
| C-11 | Any change of `status` on Shot, Task, Version, Review, Timelog: `PATCH`/`PUT`, bulk-update, the actions (`approve`, `promote`, review actions, timelog `approve`/`reject`), `archive`/`restore` | Written directly, many places, no record (F-M5). | One service, `StatusService.transition_status`: the move must be allowed by `constants/workflow.py` (**400** `{"status": ["A shot cannot move from 'X' to 'Y'."]}`, or `Unknown status`), the caller needs the code for entering/leaving Approved etc. (**403**), a row is appended to `StatusHistory` and `StatusChanged` is published. Moving to the current status is a no-op. In bulk-update an item that fails reports `invalid`. | Illegal moves now fail (see below). |
| C-11a | `GET /{shots,tasks,versions,reviews,timelogs}/{id}/status-history/` (new) | none | The record's status changes, newest first: `from_status`, `to_status`, `reason`, `actor_id`, `actor_name`, `changed_at`. Needs the entity's `*.view` code and membership. | New endpoint. |
| C-11b | `POST /timelogs/{id}/approve/`, `/reject/` | Any current status. | Approve and reject only from `Submitted` (from `Draft`, `Rejected` or `Approved` they are 400); `Approved` is final. | A second decision on an approved timelog is 400. |
| C-11c | Review actions | Any status to any status. | `Closed` is final; the rest may move among the open statuses and to `Closed`. | Reopening a closed review is 400. |
| C-12 | Every create and update through the API | `created_by`/`updated_by` stayed empty (F-M6). | The services receive the user, so both are set. | none |
| C-12a | `POST /projects/` | Not atomic; the creator was not a member and could not see the project (F-M9). | One transaction: project, the creator's membership (role `Production Admin`, linked to the `production-admin` role when it exists; platform admins get none) and, for episodic projects, `EP101`. A failure leaves nothing. | The creator sees the new project. |
| C-13 | `POST .../bulk-create/` on shots, assets, tasks, sequences, episodes | Items went to `create()` unchecked; the form path accepted every model field (`is_deleted`, `created_by_id` ...); errors returned `str(exc)` (F-H5). | Every item is validated by the entity's create serializer and by the same checks as a single create (episode/sequence chain, same-project references, locked fields, privileged status). The form path only accepts the serializer's writable fields. A rejected item reports `invalid` with the serializer errors. Unexpected failures report `The item could not be created.`; the reason is only logged. | Items that were silently accepted may now be `invalid`. |
| C-14 | `POST /tasks/bulk-status/` | `queryset.update`, no history, always `success: true`. | One transition per task. Response keeps `success` and `updated_count`, adds `failed_count` and `results[]` (`id`, `status` = `updated` / `not_found` / `invalid`, `error`). `success` is `false` when any item failed. | Read `results`. |
| C-14a | `POST /tasks/bulk-assign/` | Looped inline. | Same checks as before (P2), written through `TaskService.assign_task`; response adds `results[]`. | none |
| C-15 | Change log (`apps/audit`) | Shot, Sequence, Asset, Task, Version, Project; foreign-key swaps untracked; JSON columns (e.g. a shot's `pipeline`) showed as changed on every save. | Also Episode, Review, Timelog, ProjectMembership. For production models a changed foreign key (`episode_id`, `assignee_id`, `reviewer_id` ...) appears in `changed_fields`; `created_by`/`updated_by` never do. JSON columns compare in one text form, so unchanged ones no longer log. Other apps are unchanged. | Fewer, more accurate change-log rows. |

### Transition maps (`apps/production/constants/workflow.py`)

* **Shot:** live statuses move freely except the listed restrictions: `Approved` may be entered from any live status and left only to `In Progress`, `Retake`, `On Hold`, `Archived`; `Archived` leaves only to `Not Started` or `In Progress`.
* **Task, Version:** any live status to any other and to `Archived`; `Archived` to `Not Started` or `In Progress`.
* **Review:** open statuses to each other and to `Closed`/`Archived`; `Closed` is final.
* **Timelog:** `Draft` to `Submitted`; `Submitted` to `Approved`, `Rejected` or `Draft`; `Rejected` to `Submitted` or `Draft`; `Approved` is final.
* **Permissions on top of `*.update`:** entering or leaving Approved needs `shot.approve` (shot) or `version.publish` (version); entering Approved, Rejected, Changes Requested, Retake needs `review.approve`; entering Approved or Rejected needs `timelog.approve`.
* The maps are deliberately loose for tasks, versions and live shots until Q7 is answered; tightening them is a change to this one file. Separation of duties (an approver who is also the artist) is **not** enforced yet.

### Frontend change list (adds to Phase 2)

8. Handle `400 {"status": [...]}` for an illegal move and `403` for a missing approve/publish code on status changes.
9. `bulk-status`: read `results` and `failed_count`; `success` can now be `false`.
10. `GET .../status-history/` is available for the five entities.
11. `POST /projects/` makes the caller a member; do not add them again.


## Phase 3 follow-up — workflow fences, separation of duties, timelog rules, role matrix

Decisions: `DECISIONS.md` D-03 to D-08. Migration `0024` (additive): `StatusHistory.override_kind`, `Timelog.adjustment_of`.

| ID | Endpoint | Before | After |
|---|---|---|---|
| C-16 | Status moves (all paths) | Loose maps (P3). | Fenced maps: Approved from Pending Review only and left only to Archived; Archived, Closed (review), Approved (timelog) final; published version frozen; **400** `{"status": [...]}`. `production.status.override` + `override_reason` crosses a fence (400 `override_reason` when the reason is missing); recorded. Bulk never overrides. |
| C-16a | `POST .../{id}/restore/` | Left status "Archived". | Returns the record to the status it had before archiving. |
| C-17 | Approvals of timelogs, reviews, versions | Anyone with the approve code (timelogs: not on own log, superuser excepted). | **403** `separation_of_duties` when the actor produced the work; every path; `production.sod.override` + `override_reason` is the only way through (superuser does not imply it). Actions accept an optional `override_reason` body field. |
| C-17a | `approve` / `reject` actions | A repeated decision was a no-op or an invalid move. | The same status again is **409** (someone else decided first); exactly one history row. |
| C-18 | `POST /timelogs/{id}/reject/` | Reason optional. | `rejection_reason` required (400). |
| C-18a | `PATCH`, `DELETE`, `archive` of an Approved timelog | Allowed. | **409**; correct with a new entry. |
| C-18b | `POST /timelogs/` | none | Optional `adjustment_of` (an approved timelog of the same project and person; non-zero, possibly negative hours). `adjustment_of` appears in timelog responses. |
| C-18c | `GET /timelogs/` and every timelog action | Whole project for `timelog.view`. | Own timelogs for `timelog.view`; the project's with the new `timelog.view_all`. Others' logs are 404. |
| C-19 | `POST /tasks/bulk-status/` | 200, `success`, `updated_count`, `failed_count`, `results[]` with `status`. | 1 to 100 ids; **200** all ok / **207** partial; `results[]` is `id`, `ok`, `error` (`null` / `not_found` / `invalid_transition`); a task the caller cannot reach is `not_found`, like a missing one. |
| C-20 | Role catalog (`init_platform`) | Many enforced codes granted to no role. | See DECISIONS D-07. New codes: `timelog.view_all`, `production.status.override`, `production.sod.override` (the last two granted to nobody). **Re-run `init_platform`.** Existing extra grants are kept. |

Frontend: read `failed_count` / `results` from `bulk-status` and handle 207; the shot and version status selectors must offer only legal moves (see DECISIONS D-03 for the call sites); show 403 `separation_of_duties`; stop editing approved timelogs; use `adjustment_of`.


## Scheduling endpoints (D-09)

| ID | Endpoint | Before | After |
|---|---|---|---|
| C-21 | `GET /api/v1/scheduling/capacity/`, `GET /api/v1/scheduling/overbooking/` | Any authenticated user. | Needs `schedule.view` (**403** without). |
| C-21a | `POST /api/v1/scheduling/resolve-overbooking/` | Any authenticated user flagged any resource's bookings. | Needs `schedule.update` (**403**). Flags only bookings of the caller's projects and studio-wide ones. |
| C-21b | `conflicting_events` of an overbooking alert | Titles and project codes of every project's bookings. | Other projects' bookings are listed anonymously (`title` "Booked on another project", `project_code` null); hours and the excess are unchanged. |

Frontend: users without `schedule.view` now get 403 on the scheduling board; the seeded lead-artist and artist roles hold it (re-run `init_platform` on older databases that predate it).

## Codes, frame ranges and shot sequences (D-10, D-11)

| ID | Endpoint | Before | After |
|---|---|---|---|
| C-22 | `code` on episode, sequence, shot, asset, task, version (create, update, bulk import) | Any string, unique per project by exact case. | Trimmed and **upper-cased**; unique per project **ignoring case**; whitespace or `/` is a **400**. A duplicate is the same 400 as before. |
| C-22a | `PATCH` shot or asset `code` after the entity has a version | Accepted. | **400** "frozen once a version exists. Use the rename-code action." |
| C-22b | `POST /api/v1/shots/{id}/rename-code/`, `POST /api/v1/assets/{id}/rename-code/` | Did not exist. | Body `{"code": "..."}`; needs `production.code.rename` (**403** without; seeded to production-admin only). Returns the entity. Copies of the code on tasks, versions and reviews follow. |
| C-23 | `frame_in` / `frame_out` (episode, sequence, shot), `start_frame` / `end_frame` (version) | Any numbers. | `out < in` is a **400** on the field. A database check also holds. |
| C-24 | `sequence_code` on shot create/update | Free text. | Read-only: sending it is a **400** ("Use sequence_id."). Still returned. |
| C-24a | `sequence_id` on shot create/update | Did not exist. | Optional; an id or a code of the shot's project (any case); null or "" clears it; an unknown one is a **400**. |
| C-24b | Shot responses | `sequence_code` only. | Also `sequence_id` (null when the shot has no sequence). |
| C-24c | `GET /api/v1/shots/?sequence_id=` | Did not exist. | Filters by id or by code. The existing `sequence_code` filter keeps working. |
| C-24d | `shots_count` on a sequence | Counted by text. | Counts the sequence's live shots by foreign key. |

Frontend change list: send `sequence_id`, never `sequence_code`; expect codes in upper case in every response and form; a rename of a shot/asset code after its first version goes through the rename action; show the field error for out-of-order frame ranges.

Deploy: run `manage.py report_production_data` on each shared database before migrating (0025 refuses on conflicts and says which rows), then `init_platform` to seed `production.code.rename`.

## Sequence episode, archive guard, creator (D-12, D-13, D-14)

| ID | Endpoint | Before | After |
|---|---|---|---|
| C-25 | `episode_id` on sequence create/update | Did not exist. | Optional write alias (id or code of an episode of the project). Episodic project: required on create, cannot be cleared; unknown or other-project episode is a **400** "Unknown episode.". Standard project: a non-empty value is a **400**; empty is accepted. |
| C-25a | Sequence responses | No episode. | Also `episode_id` (null on older rows and standard projects). |
| C-25b | `GET /api/v1/sequences/?episode_id=` | Did not exist. | Filters by id or by episode code. |
| C-25c | Shot create/update `episode_id` with a `sequence_id` whose sequence has an episode | Any episode of the project. | A different episode is a **400** ("The episode must be the episode of the sequence."); omitted takes the sequence's. Moving the shot to another sequence moves its episode. |
| C-25d | `PATCH` a sequence's `episode_id` | n/a | Its shots (archived ones too) move to the new episode. |
| C-26 | `DELETE /sequences/{id}/`, `POST /sequences/{id}/archive/`, `/episodes/{id}/` the same | Archived whatever was inside. | **400** while it has live shots (episodes: live sequences or shots), naming them. The row is left unchanged. |
| C-26a | `POST /sequences/bulk-archive/`, `/episodes/bulk-archive/` | Every found id archived. | An item with live children reports status `has_children` and counts as failed (`partial_success` true); the other items are archived. |
| C-27 | `POST /organizations/projects/{id}/members/` | Platform admins only. | Also the person who created that project, when their role holds `project.update`. Message for others: "Only platform admins or the project's creator may manage project members." (**403**). |

Frontend change list: send `episode_id` when creating a sequence on an episodic project and pick it in the sequence form; read `episode_id` from sequence responses; archive shots before their sequence and sequences before their episode (or handle the 400 / `has_children`); do not send an episode for a sequence of a standard project.

Deploy: run `manage.py report_production_data` after migrating: it now also lists sequences of episodic projects with no episode and shots whose episode differs from their sequence's. Migrations 0028 (column) and 0029 (fill) change no existing shot.

## Derived hours and current version (D-15, D-16)

| ID | Endpoint | Before | After |
|---|---|---|---|
| C-28 | `logged_hours` on every task response | A stored number nothing maintained (0 unless seeded or typed before P2). | The sum of the task's **approved** timelogs, two decimals as text as before. |
| C-28a | `pending_hours` on every task response | Did not exist. | The sum of the task's **submitted** timelogs. Read-only. |
| C-28b | `logged_hours` sent on task create/update | **400** when different from the stored value. | **400** when different from the derived value; echoing it is accepted. |
| C-28c | `GET /organizations/projects/{id}/resources` `hours_logged` | Sum of the stored numbers. | Sum of approved timelogs. |
| C-29 | `current_version` on every shot response | A stored text, default "v001", writable. | The latest published version's number, else the latest version's, else "". Read-only. |
| C-29a | `current_version_id` on every shot response | Did not exist. | The id of that version, or null. |
| C-29b | `current_version` sent on shot create/update | Stored as typed. | **400** when different from the derived value; on create "" and "v001" are accepted and ignored. |
| C-29c | `recent_shots[].current_version` of the project dashboard | The stored text. | The derived value; omitted when empty (as before). |

Frontend change list: show `pending_hours` next to `logged_hours` (hours awaiting approval); stop sending `logged_hours` and `current_version`; treat an empty `current_version` as "no versions yet" instead of "v001"; read `current_version_id` to link to the version.

Deploy: run `manage.py report_production_data` and look at "Tasks whose stored hours differ": those numbers will no longer be shown. Nothing is changed in the database by this phase (no migration).

## Scheduling leave requests (D-20)

| ID | Endpoint | Before | After |
|---|---|---|---|
| C-30 | `POST /api/v1/scheduling/leaves/` | `status`, `approved_by`, `approved_at`, `total_days` were accepted as sent. | Always Pending; `total_days` computed (inclusive); any decision field or a different `total_days` is a **400**; `end_date` before `start_date` is a **400**. |
| C-30a | `PATCH`/`PUT /leaves/{id}/` | Any field, any state. | **400** unless the leave is Pending; decision fields as above. |
| C-30b | `POST /leaves/{id}/approve/` | Any state, any approver; `approved_at` was the row's last update time. | Pending only (**400** otherwise); the leave's own person gets **403**; `approved_by` / `approved_at` are the actor and now. |
| C-30c | `POST /leaves/{id}/reject/` | Any state; nobody recorded. | Pending only (**400**); own leave **403**; reason required (**400**); records `rejected_by` and `rejected_at`. |
| C-30d | Leave responses | Everyone with `schedule.view` saw `reason`. | Also `rejected_by`, `rejected_at`. `reason` and `rejection_reason` are "" unless the caller is the person it is for, holds `schedule.update`, or is a superuser. |

Frontend change list: treat `status`, the decision fields and `total_days` as read-only on the leave form; do not send them; show the reason only when it comes back non-empty; handle the 403 when a manager decides their own leave and the 400 when a leave was already decided.
