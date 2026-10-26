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
