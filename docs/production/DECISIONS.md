# Production decisions

Answers and interim choices for the open questions of `ANALYSIS.md` / `PLAN.md`. Contract-visible effects are in `CONTRACTS.md`. Branch `feature/production-hardening`.

Status: **A** answered by the owner, **I** interim (a default used so work could continue, still open), **O** open.

| ID | Question | Status | Decision |
|---|---|---|---|
| D-01 | Q13: now read-only fields | A | **400** when sent. Echoing the stored value is accepted. Fields with no dedicated action yet (status, pipeline, `client_approved`) are guarded by the approve code instead of locked. |
| D-02 | Q17: touch `apps/core`, `apps/audit` | A | Yes. Done: serializer-based bulk whitelist and a service-kwargs hook in the core bulk mixin; change tracking for Episode, Review, Timelog, ProjectMembership and production foreign keys. |
| D-03 | Q7: status workflow | A (maps) | One table per entity in `apps/production/constants/workflow.py`, tested table-driven (`tests/test_workflow_table.py`). Working states move freely; only the meaningful states are fenced (below). Per-project configurable status lists stay out of scope. |
| D-04 | Separation of duties | A | Implemented in `StatusService` (below). |
| D-05 | Timelog flow | A | Below. |
| D-06 | Q14: creator's role in a new project | A | Decided, see D-14. The creator gets a membership labelled "Production Admin" (platform admins none); the label grants nothing. The creator may add members to the project they created, if their role holds `project.update`. |
| D-07 | Role-to-code matrix | proposed | Below; seeded by `init_platform`, pinned by `tests/test_permission_matrix.py`. Needs your approval. |
| D-08 | `bulk-status` contract | A | Below. |
| D-09 | Scheduling endpoints | I | Below. |

## D-03 Transition maps

* **Working states** (shot: Not Started, In Progress, Pending Review, Retake, On Hold; task and version: the same without On Hold) move freely among themselves.
* **Approved** is entered from Pending Review only and left only to Archived. Entering or leaving it needs `shot.approve` (shot) or `version.publish` (version).
* **Archived** is left only by the restore bookkeeping, which returns the record to the status it had before (from `StatusHistory`), or Not Started.
* **Review:** Pending Review to Submitted / In Review / Closed; In Review decides (Approved, Rejected, Changes Requested, Retake); Approved goes only to Closed; **Closed is final**. Decisions need `review.approve`.
* **Timelog:** Draft to Submitted; Submitted to Approved, Rejected or Draft; Rejected to Submitted or Draft; **Approved is final**.
* **Published version:** its status is frozen.
* **Corrections:** `production.status.override` plus an `override_reason` lets a caller cross those fences for shot, task, version and review. Never for a timelog. It does not replace the approve codes. It is granted to no seeded role (not even platform-admin), superuser does not imply it, and a scoped API key/token must list it. Every use is a `StatusHistory` row with `override_kind = "status"` and the reason. Bulk endpoints never override.
* **Frontend flows that assumed free movement** (read from `studiohub-react`, not run): the shot status dropdown on `ShotsPage` (`handleStatusChange` offers every status for any shot, so Not Started to Approved now fails); the version status select on `VersionWorkspacePage`; the bulk status action on `TasksPage` (any status for any selection, so Approved from a working state and anything out of Approved or Archived now report `invalid_transition`); the shot pipeline step selector (`handlePipelinePassChange`) is unchanged but approving a step still needs `shot.approve`. No drag-and-drop status change was found. The frontend only types `success` for the bulk endpoints (`TaskService.ts`) and never reads it; `TasksPage` shows its "updated N tasks" notice after any 2xx, so with 207 it will claim success for a partial result until it reads `failed_count` / `results`.

## D-04 Separation of duties

* Approving work you produced is refused with **403** `separation_of_duties` on every path, because the check is in `StatusService` (and in `ReviewService.guard_approval` for verdicts that move no status): the actions, a plain `PATCH` of `status`, `promote`, the review verdict and participant-verdict actions, bulk loops (no bulk endpoint reaches these entities; a test pins that and a service-level loop test covers the rest), and API keys / tokens (the credential acts as its owner).
* **Producers:** timelog: the person and whoever created the entry. Version: its artist, its creator, and the task's assignee now or at any earlier time (read from the change log, so handing the task over before approving does not help). Review: whoever moved it to Submitted, and the producers of what it reviews (version, shot artist, task). The review's creator is **not** a producer: the reviewer who sets a session up is the one who approves it.
* **Applies to:** timelog Approved/Rejected; review Approved (status, verdict, participant verdict); version Approved (status, promote, including promoting an already approved version). Not to shots (not requested).
* **Override:** `production.sod.override` plus an `override_reason`, recorded in `StatusHistory.override_kind = "self_approval"`. Off by default (granted to no role, superuser does not imply it, a scoped credential must list it).
* **Known limit:** the "ever assigned" check reads the change log, which is best effort by design; a task assignee who never appears in it is not caught.

## D-05 Timelogs

Approve and reject only from Submitted; Approved is final (a second approval is **409**, an edit, delete or archive of an approved log is **409**); reject requires a reason (kept in the history row and `rejection_reason`); a correction is a new entry with `adjustment_of` pointing at the approved log (same person, same project, non-zero hours, may be negative), which goes through Submitted to Approved like any other.

## D-07 Role-to-code matrix (proposal, seeded)

Least privilege. `timelog.view` shows the caller's own timelogs; `timelog.view_all` shows the project's and is a separate code; `timelog.manage` logs time for others. Existing deployments keep any extra grants they already have: `init_platform` only adds.

| Resource | production-admin, vfx-supervisor, org-admin | lead-artist | artist |
|---|---|---|---|
| project | view create update delete | view | view |
| sequence, episode | view create update delete | view | view |
| shot | view create update delete approve | view update approve | view |
| asset | view create update delete | view create update | view |
| task | view create update delete | view create update | view update |
| timelog | view view_all create update delete approve manage | view view_all create update approve | view create update |
| version | view create update delete publish | view create update publish | view create |
| review | view create update delete approve | view create update | view |
| playlist | view create update delete | view create update | view |
| media | view create update delete | view create update | view create |
| workflow | view create update delete | view | view |
| schedule, track, show, delivery, publishing | view create update delete | view | view |
| automation | view create update delete | none | none |
| note | create | create | create |
| audit | view | view | none |
| `production.status.override`, `production.sod.override` | none | none | none |

`org-member` holds no production code. `platform-admin` holds the whole catalog except the two opt-in codes. Not decided here: a narrower role than "full" for `vfx-supervisor`; deletes for leads; review decisions for leads.

## D-08 `POST /tasks/bulk-status/`

1 to 100 distinct task ids and a `status` (anything else is a 400 for the whole request). **Partial, not all-or-nothing:** each task is its own transaction. **200** when every item succeeded, **207** when at least one did not (including all). `results[]`: `id`, `ok`, `error` (`null`, `not_found` or `invalid_transition`). A task the caller cannot see, may not touch or that does not exist all report the identical `not_found`. Same map as a single update; no override. `success`, `updated_count` and `failed_count` remain for older clients.

## Open

* Q5, Q6 and Q10 of `ANALYSIS.md` / `PLAN.md`: nothing is built that needs them; decide when a real request comes (Q5 asset variants and libraries, Q6 task templates, Q10 ShotGrid features not wanted). Q1 (hierarchy shape) is answered by what was built: explicit foreign keys per level plus a denormalized `project`. Decided: Q2 (D-12), Q3 and Q15 (D-11), Q4 (D-10), Q9 and Q14 (D-14), Q16 (D-13), Q18 (D-15), Q19 (D-16), Q8 and Q11 and Q12 (D-17 to D-19), Q20 and Q21 (process).
* **Fixed:** the production scheduling endpoints (`capacity`, `overbooking`, `resolve-overbooking`) used to need only a login. See D-09.
* Not looked at: the scheduling app's own viewsets (`/scheduling/events|resources|schedules|leaves|holidays/`) were out of scope; check whether they scope by project.

## D-09 Scheduling endpoints

* `GET /scheduling/capacity/` and `GET /scheduling/overbooking/` need `schedule.view`; `POST /scheduling/resolve-overbooking/` needs `schedule.update`. Any other method is denied.
* **Capacity** is a studio-wide aggregate per department (no names, projects or titles), so it is not narrowed by project.
* **Overbooking:** the excess always counts every booking, so it is true. The bookings listed under an alert are limited to the caller's projects and studio-wide ones (no project); other projects' bookings appear as "Booked on another project" with no project code. Platform admins see all.
* **Resolve** flags only the bookings the caller may see; others stay as they are but still count toward the excess.
* Interim choice: the cut is by project membership. Whether resource planners should see all projects' bookings (a separate code, like `timelog.view_all`) is open. Seeded roles: `schedule.view` for lead-artist and artist, `schedule.update` for the full roles only.

## D-10 Codes and frame ranges (Q4; WP B3, B7)

* **Unique per project, any case.** `sh010` and `SH010` are the same code. A database constraint on `upper(code)` per project backs the checks in the serializers, bulk import and the shot/asset viewset chain, on episode, sequence, shot, asset, task and version. Soft-deleted rows still hold their code.
* **Stored upper-case.** Writes are trimmed and upper-cased. A code containing whitespace or `/` is a 400. Length limits are unchanged. Nothing stricter is imposed (no pattern like `SH\d+`): studios differ, and that needs a decision of its own.
* **Updating a code to the same code in another case** is accepted and keeps the stored value.
* **Shot and asset codes freeze once the entity has a version.** Changing one through the normal update is a 400 ("frozen once a version exists. Use the rename-code action."). Sequences and episodes can be renamed freely; their shots keep pointing at them (see D-11).
* **`POST /shots/{id}/rename-code/` and `/assets/{id}/rename-code/`** need the opt-in code `production.code.rename` (seeded to production-admin only, not held by platform-admin by default). The service locks the row, checks uniqueness, updates the `entity_code` copy on that entity's tasks, versions and reviews, and records the change in the audit log. Renaming is the only way past the freeze.
* **Frame ranges:** `frame_out >= frame_in` for episode, sequence and shot, and `start_frame <= end_frame` (when both are set) for versions, as a database check and as a 400 from the serializers.
* **Existing data.** Migration 0025 refuses, changing nothing, when case-variant duplicates (soft-deleted included) or backwards ranges exist; its message lists them. Run `manage.py report_production_data` first; it reads only.

## D-11 Shot to sequence (Q3, Q15; WP B1)

* **`Shot.sequence` is a foreign key** to `Sequence` (`PROTECT`, nullable). A shot may have no sequence (Q3). A sequence with shots cannot be hard-deleted.
* **`sequence_code` stays** as a service-maintained text copy of `sequence.code` (column kept until the final cleanup; filters, search and the response shape need it). It is no longer writable: sending it is a 400 ("Use sequence_id."). `sequence_id` (an id, or a code of the shot's own project, any case) places a shot; `null` or empty clears it.
* **Renaming a sequence** re-syncs `sequence_code` on its shots in the same transaction.
* **Migration 0027** links each shot to the sequence of its project whose code equals the old text, ignoring case and including soft-deleted sequences. A shot whose text matches nothing keeps `sequence = NULL` and its text (Q15: reported, not failed). The step is idempotent and reversible (reverse does nothing; the text was never removed).
* **Not decided:** the Sequence to Episode link (B2) still waits on Q2.

## D-12 Sequence to episode (Q2; WP B2)

* **`Sequence.episode`** is a nullable foreign key (`PROTECT`). The per-project `workflow_type` switch stays.
* **Episodic project:** a new sequence needs an episode of that project (400 on `episode_id` otherwise; an unknown or other-project episode reads "Unknown episode."). An existing sequence that has none keeps working but cannot be cleared once set, and an update that does not mention the episode leaves it as it is.
* **Standard project:** no episode. Sending one is a 400; an empty value is accepted.
* **A shot follows its sequence's episode.** When the shot's sequence has an episode, an episode that differs is a 400, and an omitted one is taken from the sequence. Moving a shot to another sequence moves its episode. A shot without a sequence keeps its own episode, still required on episodic projects. A sequence with no episode (older rows) leaves the shot's episode alone.
* **Moving a sequence to another episode** moves all its shots (soft-deleted ones included) in the same transaction.
* **Migration 0029** files a sequence of an episodic project under an episode only when all its shots (soft-deleted included) agree on one. Sequences with no shots, with shots in several episodes, or in standard projects stay `NULL`; shots are never touched. `report_production_data` lists the sequences left without an episode, and the shots whose episode differs from their sequence's.
* **Seeds** still create sequences without an episode (the older shape).
* Deliberate departure from "never written directly": a shot's `episode_id` stays writable, because shots with no sequence need it. It is checked against the sequence instead.

## D-13 Archiving a parent (Q16)

* **A sequence with live shots, and an episode with live sequences or shots, cannot be archived.** Single delete and the `archive` action return a 400 naming what is left ("SQ010 still has 3 shots. Archive or move them first."); `bulk-archive` reports that item as `has_children`, counts it as failed and carries on with the rest.
* Archived children do not count. A restore brings back only what was archived: restoring a parent does not restore its children.
* The `archive` action now runs the status change and the delete as one unit, so a refusal no longer leaves the row with status "Archived".
* **Not covered:** archiving a project, shot, asset or task with live children; restoring a child whose parent is archived. Both stay as they were.

## D-14 Creator and project roles (Q9, Q14)

* **Authorization stays global role plus membership (Q9).** `ProjectMembership.role_ref` is still not consulted; no ADR is needed. Membership is visibility.
* **Creator (Q14):** keeps the "Production Admin" membership (display only). The creator, identified by the project's `created_by`, may add members to that project through `POST /organizations/projects/{id}/members/`, in addition to platform admins. The endpoint still needs `project.update`, so a creator whose role lacks it gets a 403. This is the only right the creator record adds; it does not apply to any other project, and it is not inferred from the membership role.
* The label is not varied by the creator's own role: nothing reads it.
* **Not decided:** removing or changing members, and whether a project owner should be a stored role.

## D-15 Task hours (Q18)

* **`logged_hours` is the sum of the task's approved timelogs.** Approved corrections count (they are approved entries, possibly negative). Draft, rejected and soft-deleted entries do not.
* **`pending_hours` (new)** is the sum of the task's submitted timelogs. Approving moves hours from pending to logged at once; there is nothing to refresh.
* Both are **derived on every read** (one subquery per list, no per-row queries); they are not stored. The dashboards that show hours per artist (`/organizations/projects/{id}/resources`) use the same figure.
* Sending `logged_hours` stays a 400 ("Cannot be set directly") unless it equals the derived value, as in D-01. `pending_hours` is read-only.
* **The old `Task.logged_hours` column is no longer read or written.** Before P2 clients could type into it and nothing ever filled it from timelogs, so any non-zero value in an existing database is either a hand-typed number or a seed. Those stop appearing. `report_production_data` lists tasks whose stored number differs from their approved sum, so you can see what will change. The column is dropped in the final cleanup, with `sequence_code`.

## D-16 Shot current version (Q19)

* **`current_version` is the number of the shot's latest published version; with none published, its latest version; with no versions, an empty string.** Archived (`is_archived`) and soft-deleted versions never count. A new `current_version_id` carries the version's id (null if none).
* **"Latest" is the most recently created**, not the highest number: `version_number` and `version_index` are typed by clients and `version_index` is not maintained. Unpublishing the current published version falls back to the next published one, else the latest.
* Derived on every read like D-15. Sending `current_version` is a 400 unless it equals the derived value; on create, an empty value and the old default `v001` are accepted and ignored.
* The project dashboard's recent shots use the same value.
* **Not done:** assets. `Asset.version` and the JSON `versions` list stay as they were; they need their own decision. The stored `Shot.current_version` column is no longer read and goes in the final cleanup.

## D-17 Shot status is set by people (Q8)

* A shot's status is changed by a person through the status workflow (D-03), never computed from its tasks. Nothing in the code sets a shot's status from task changes, and this phase adds nothing that does (checked by search; no test pins the absence).
* A rollup (a shot is "Approved" when its tasks are) needs its own rules: which tasks count, what an extra or cancelled task does, who may override. Decide that when the studio asks for it.

## D-18 JSON blobs on Version and Review are caches (Q11)

* `reviews`, `playlists`, `notes_list`, `activity`, `media_items` and `attachments` on a version, and the like on a review, stay as the frontend-contract shape. They appear in the read serializer only: version create and update accept none of them (verified in the field lists), so a client cannot write them through those endpoints.
* They are not a source of truth: the review, playlist, note and media records are. Do not build features on the blobs; replacing them with relations would change the response shape for no gain in security. Not checked in this phase: what fills them, or whether review serializers behave the same way.

## D-19 Automation rules (Q12)

* **Project rules** need an `automation.*` code and membership of the rule's project; an out-of-scope rule answers 404 like an unknown id.
* **Global (project-less) rules** are created and seen by platform admins only. A member creating one is a 400. All of this is how the code already works (WP A1) and `tests/security/test_automation_authz.py` pins it.
* **Not added:** a separate permission code for global rules. It would only matter if a role other than platform admin should own them; add it then.

## D-20 Leave requests (scheduling app, `/scheduling/leaves/`)

Found in the review of the scheduling app's own viewsets (see the review notes below); this is the first of the fixes.

* **A request starts Pending and is decided once.** Status, `approved_by`, `approved_at`, `rejected_by`, `rejected_at`, `rejection_reason` and `total_days` cannot be sent: a different value is a 400 ("Cannot be set directly"); echoing the stored value is accepted (as D-01). `total_days` is computed from the dates (both days counted); an end date before the start date is a 400.
* **Edits only while Pending.** Changing a decided request is a 400.
* **Approve and reject** (`schedule.update`) work from Pending only (a 400 otherwise, so an approved leave can no longer be rejected afterwards, nor the reverse), take a row lock and re-read the status inside it (two racing decisions: one wins, the other gets the 400). They record who and when with the real time; rejecting records `rejected_by` / `rejected_at` (new columns, migration 0003) and requires a reason.
* **Nobody decides their own leave** (403), whether they hold the code or not and whatever their role. A resource with no user (a room, a studio) can be decided by anyone with the code. Consequence: a studio with a single manager cannot approve that manager's own leave; a second person with `schedule.update` is needed. There is no override as for timelogs (D-04); add one if that turns out to hurt.
* **Reasons are private.** `reason` and `rejection_reason` are shown to the person the leave is for and to approvers (holders of `schedule.update`, and superusers); everyone else with `schedule.view` gets empty strings. The request itself (who, which dates, type, status) stays visible, because planning needs it.
* **Interim choices, yours to confirm:** "approver" is whoever holds `schedule.update` (the full roles); a dedicated HR or producer code was not added. Artists still cannot request leave: they hold `schedule.view` only, although the create action falls back to the caller's own resource. Whether they should hold `schedule.create` for that, limited to their own resource, is open.

### Review of the scheduling app's own viewsets (item 1 above, item 2 in D-21, items 3 and 4 in D-22: all fixed)

Verified by running the endpoints in the test database, 2026-10-26:

* Events, resources, schedules and leaves are platform-global (no project scoping): any `schedule.view` holder saw a Private event of a project they are not in, every resource's `hourly_rate_usd` and `user_email`, and a booking could link a task of a project the caller is not in (the task title came back).
* `book` stores any `status` text and an end before the start; `update-status` stores any status text and moves Completed back to Scheduled; event create takes any `project_id` without a membership check.
* `PATCH` on an event answers 500 (its update serializer has no `update()`); resources likely the same, not tried.

## D-21 Calendar visibility and pay rates (scheduling app; review item 2)

* **Events follow `visibility`.** `Private`: its creator only. `Team` (the default): the members of its project; an event with no project is visible to everyone who may view the schedule, because an event has no team of its own to narrow it. `Organization` and `Public`: everyone who may view the schedule, whatever the project. The creator always sees their own event; platform admins and superusers see everything, private events included. An event the caller may not see is a 404 on read, edit, delete and `update-status`.
* **Bookings keep the slot, lose the titles.** A `/schedules/` row tied to an event or task the caller may not see shows "Booked on another project" for the title and an empty `notes`; times and resource stay (planning needs them). Same wording as D-09.
* **Pay rates and e-mail need `schedule.view_rates`.** Without it `hourly_rate_usd` is `null` and `user_email` is "" in resource lists and detail. A person always sees their own resource's values. A superuser sees all. The code is seeded to the full roles (production-admin, vfx-supervisor, org-admin; platform-admin holds the whole catalog) and not to lead-artist or artist. Re-run `init_platform` on each database.
* **Interim choices, yours to confirm:** the project-less `Team` events (visible to all) and platform admins reading private events; "Team" has no meaning beyond project membership; whether lead-artists need the rates code to plan their team.
* **Not part of this fix** (items 3 and 4 of the review): creating an event on a project the caller is not in, linking a booking to a foreign task or event on write, unvalidated statuses and times, and the `PATCH` 500s.

## D-22 Checked writes in the scheduling app (review items 3 and 4)

* **References stay in scope.** Booking an event or task (`/schedules/` create and edit, and the `event_id` / `task_id` of `/resources/{id}/book/`) needs an event the caller may see (D-21) and a task of one of their projects (platform admins: any). An unknown id, a malformed one and one out of reach all answer the same 400 ("Unknown event." / "Unknown task."). An event created with a `project_id` needs a project the caller belongs to (platform admins: any); otherwise "Unknown project.", where an unknown project used to be dropped silently.
* **Values are validated.** `book` takes a status from the booking statuses (default Booked), real date-times and a non-negative duration (an end before the start is a 400, here, in `block`, on schedules and on events); a bad payload stores nothing.
* **Event statuses.** Only the five known ones are accepted. **Completed and Cancelled are final**: changing them is a 400, echoing the same status is accepted. The other states move freely. This holds for `update-status` and for a status inside a `PATCH`. The status change takes a row lock. *Interim:* no further transition map (for example Postponed to Completed) was asked for; add one if wanted.
* **Resources.** A duplicate `code` is a 400 in any case, soft-deleted resources included (it used to be a 500 from the database). `user_id`, `department_id` and `team_id` must exist ("Unknown user." and so on) instead of being dropped silently; the same for department and team on edit.
* **The `PATCH`/`PUT` 500s are fixed** for events and resources: their update serializers had no `update()`. Both answer with the detail shape, like reads. An event edit goes through the same status rule; a resource edit cannot change its code or type (as before).
* **Not changed:** overlapping bookings are still allowed (overbooking is reported, not prevented); no transition rules for resources' own status; leave and holiday viewsets other than as in D-20.

## D-23 Numbered codes and the episode code (WP B4, B5)

* **Numbering on request.** In `POST .../bulk-create/` (the flat form, any entity), an item may leave out `code` and send `code_prefix` (for example `"SH"`): its code is the next number of that series in its project, `SH0010`, `SH0020`, ... The first is the next multiple of 10 above the highest number in use with that prefix (any case, soft-deleted rows included); four digits, ten apart. Typed codes and numbered ones can be mixed. The prefix is letters, digits, `_` or `-`, starting with a letter, 20 characters at most; a bad one fails its own items ("The codes could not be numbered; check code_prefix.").
* **Race-free.** A batch with numbered items runs in one transaction that locks the project row, so two batches numbering the same project wait for each other and never get the same code (checked by a concurrency test that fails without the lock). Each item is still its own savepoint: one bad row does not undo the others. Batches without numbered items are unchanged. The step (10) and padding (4) are fixed in this version; the service takes them as arguments if a studio wants other values. The form of bulk-create that wraps items in `action` / `data` does not number.
* **Episode code derivation** (new rows only, when no code is typed): `EP101` for season 1 episode 1 as before; larger numbers use `EP{season:02d}{episode:03d}` (`EP12034`). Seasons up to 9 with episodes up to 99 keep the 5-character form, anything else the 7-character form, so no two pairs can produce the same code (`S1E101` and `S11E01` both used to give `EP1101`). Season above 99 or episode above 999 derive nothing: a code must be typed (400). Existing codes are not touched.
* **Not done from B4/B5:** a format pattern per entity (declined, D-10), reserved ranges.

## D-24 Lifecycle: history is protected (WP B9, partly)

* **Done:** archiving a parent with live children is refused (D-13); restore returns a row to the status it had before it was archived (existing behaviour). Now also: the project foreign key of **Task, Version, Timelog, Review and ProjectNote**, and **Timelog.person**, are `PROTECT`: a project with any of these, and a person with time logged, cannot be hard-deleted (a database-level change of nothing, only Django's delete rule; migration 0030 has no SQL). A project holding only structure (sequences, shots, ...) can still be removed for good.
* **The admin cannot delete production rows.** `has_delete_permission` is false and the bulk delete action is removed for every production admin class, superusers included; archive through the API. This also covers membership, show, editorial and automation records; relax a class if the admin needs it.
* **One archive flag: done in D-25** (it was left out of P6 because it changes what lists show for existing rows).

## D-25 One archive marker: archived means soft-deleted (WP B9, last part)

`is_archived` existed on Task, Asset, Version, Playlist and Workflow with different meanings: Task and Playlist set it together with archiving, Version and Workflow archived by the flag alone (no soft delete, no way back except editing the field), Asset's was a field clients could type. From now on:

* **Archived = soft-deleted.** `archive` soft-deletes (with the status "Archived" where the entity has a status workflow, as before for shots and sequences); `restore` undoes it. The same actions exist on all five. Version and Workflow had flag-only archive actions: those are replaced by the common ones. Side effects kept: an archived playlist is labelled "Archived" and restored as "Active"; an archived workflow is switched off (`is_active` false) and a restored one stays off until re-activated.
* **`is_archived` in responses is derived** from the soft delete and read-only everywhere. Sending it on create or update is a **400** unless it equals the current value (as D-01); the Workflow update form never accepted it, so there a write is ignored.
* **`?is_archived=true`** lists the archived rows (needs the resource's delete grant, as `include_archived`; without it the answer is empty, never the live rows); `?is_archived=false` the live ones. Archived versions no longer count for a shot's current version; they could not be listed or picked before anyway once soft-deleted.
* **Migration 0031 (data).** Rows with the flag set and no soft delete are soft-deleted (`deleted_at` = now, `deleted_by` empty), so the data says what the code now says. Rows already soft-deleted and the column itself are untouched. Reverse does nothing (it cannot tell these rows from properly archived ones); the ids are logged (first 500 per model, event `archive_flag_reconciled`) so they can be restored by hand. **Run `report_production_data` first: "flag only" is the number of rows that will disappear from default lists.** This was built without having seen real numbers (nothing was run outside the test database); the report is the check.
* **The column stays** until the final cleanup (P12), unread and unwritten; the admin lists and filters use `is_deleted` instead. The seed commands still write the old column from mock data, so a seeded "archived" mock row stays live.
