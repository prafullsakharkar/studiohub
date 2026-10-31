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

* Q10 of `ANALYSIS.md` / `PLAN.md` (ShotGrid features not wanted): nothing is built that needs it. Q5 and Q6 are decided in D-27. Q1 (hierarchy shape) is answered by what was built: explicit foreign keys per level plus a denormalized `project`. Decided: Q2 (D-12), Q3 and Q15 (D-11), Q4 (D-10), Q9 and Q14 (D-14), Q16 (D-13), Q18 (D-15), Q19 (D-16), Q8 and Q11 and Q12 (D-17 to D-19), Q20 and Q21 (process).
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

## D-26 Which assets a shot uses (WP C1, plan phase P7)

* **A link table with its own data.** `ShotAsset(shot, asset, quantity, notes)`, with the project copied on for scoping and the usual audit columns. At most one **live** link per shot and asset (the database enforces it; the service checks first for a clear message); `quantity` at least 1 (database check). Shot and asset are `PROTECT`: a linked shot or asset cannot be hard-deleted.
* **Same project only.** The asset is named by id or code (any case) inside the shot's own project. One of another project, a missing one, an archived one and a malformed id all answer the same 400 "Unknown asset." Cross-project libraries and variants are not part of this (Q5, plan C3 and C6 are not done).
* **Endpoints.**
  * `GET /shots/{id}/assets/` lists the shot's assets with code, name, category, status, thumbnail, quantity and note; needs `shot.view` and `asset.view`.
  * `POST /shots/{id}/assets/` links one (`asset_id`, optional `quantity` default 1, `notes`); 201; needs `shot.update` and `asset.view`. A second live link of the same pair is a 400.
  * `PATCH /shots/{id}/assets/{asset id or code}/` changes quantity or note; `DELETE` on the same path unlinks (204). Both need `shot.update`. A link that does not exist is a 404.
  * `GET /assets/{id}/shots/` lists the shots that use an asset; needs `asset.view` and `shot.view`.
  * Bodies reject unknown keys. A non-member gets 404 on all of them, like the shot itself.
* **Seeded roles:** artists can read links (they hold both view codes); leads and the full roles can change them (they hold `shot.update`). No new permission code.
* **Unlinking** soft-deletes the row, so linking the same pair again later works and the old row stays as the trail (who unlinked it and when). Archived shots and assets drop out of both lists; their links are not removed. The change log records creating and changing a link; it does not record soft deletes for any model.
* **Not done:** archiving an asset that live shots use is still allowed (plan C5 would warn or block; D-13 covers sequences and episodes only); a count of shots per asset in the asset's own responses; ordering of an asset's shots other than by code.

## D-27 Task types, task templates, asset types and parent assets (Q5, Q6; WP D1, D3, C2, plan phase P8a)

**Q5 (asset variants and libraries): not built.** Assets stay project-only. No variant model and no cross-project library: they would open a second access model to a code base scoped everywhere by project membership. Reuse across shows is a "copy asset into a project" action, to be built when asked. What was done instead:

* **`parent_asset` is checked.** On create and update the parent must be an asset of the same project (a foreign, missing or archived one reads "Unknown parent asset.", as in D-12 style) and an asset cannot be its own ancestor (400 "An asset cannot be its own ancestor."; the walk up stops after 50 steps, so old data holding a loop cannot hang a request). Existing violations are listed by `report_production_data`.
* **`Asset.asset_type`** (new, optional) links an asset to the masterdata asset type catalog. `category` stays as the contract text; the two are independent. Writes take `asset_type_id` (id or code; an unknown or archived entry is a 400 "Unknown asset type."); responses show `asset_type_id`, `asset_type_code`, `asset_type_name`. **Migration 0034** links each asset whose `category` equals the code or name (any case) of exactly one live catalog entry; none or several matching leaves it unlinked. Nothing is guessed, nothing fails; the report counts what is left.

**Q6 (steps and templates).**

* **Steps are the masterdata task type catalog** (`MasterTaskType`); no new step model. `Task.task_type` (new, optional): writes take `task_type_id` (id or code, active entries only, else "Unknown task type."), `""` clears it; responses show `task_type_id`, `task_type_code`, `task_type_name`. Setting a type also fills a blank `department` from the type. **Older tasks keep no type**: their `department` is a department, not a step, and one department has many step types, so no backfill was attempted.
* **Templates** (`/task-templates/`): `TaskTemplate` (name, description, `entity_type` Shot or Asset, `is_active`, optional project) with items (task type, name, order, default bid in hours). No project means a **studio-wide** template, seen by everyone with `tasktemplate.view`; with a project, only that project's members see it. **No inheritance**: a project uses a studio template as it is or copies it (`copy-to-project`) and edits the copy. Names are unique per project and kind (and separately across the studio), ignoring case. An item list is replaced as a whole by `PATCH` with `items`; items that match (type and name) are updated in place, new ones added, missing ones removed.
* **Rights.** New codes `tasktemplate.view|create|update|delete` and `tasktemplate.manage_studio`. Studio-wide templates need `manage_studio` on top of the action's code to create, change or delete. Seeded: the full roles hold all five; lead-artists and artists hold `view`. Run `init_platform`.
* **Applying** (`POST /task-templates/{id}/apply/`, needs `tasktemplate.view` and `task.create`): creates one task per item for a shot or asset (id or code) of a project the caller belongs to; a project template only in its own project. Task code `<entity code>_<type code>` (`_2`, `_3` ... when taken), title = item name, `estimated_hours` = the bid, department from the type, status as any new task. It **skips every task the entity already has with the same type and name** (live ones), so applying twice, or after adding an item, only adds what is missing; the entity row is locked meanwhile, so two applies at once cannot both create a task (the race test fails without the lock). 201 when something was created, 200 when not; the body lists `created` and `existing`. A switched-off template, or one for the other kind of entity, is a 400.
* **Not done:** per-project template overrides that merge, variants, libraries, asset dependencies (C3 to C6), D6 and D7. (D2, the real links on tasks, followed in D-28.)

## D-28 What a task is about: real links (WP D2, plan phase P8b)

* **Three optional links on `Task`: `shot`, `asset`, `sequence`.** At most one is set (database check); none means a General, project-level task. They are `PROTECT`: a shot, asset or sequence with tasks cannot be hard-deleted. The record must belong to the task's own project (the API resolves it inside the project).
* **The write contract does not change shape.** Clients still send `entity_type` (Shot, Asset, Sequence, General) and `entity_id`; `entity_id` is now an **id or a code** (any case) of a live record of that type in the task's project, or the write is a 400 ("Unknown shot." and so on). An id with no type means a shot, as before. **An empty `entity_id` means the task is about no record** (General) whatever type came with it: the model's own default was always "Shot" with no id, so that combination cannot be refused. An unknown type is a 400. A write that does not touch these fields leaves them; a full PUT that sends an older task's own text back unchanged is accepted.
* **`entity_code` and `entity_name` are derived** from the linked record. Sending them is allowed if they agree with it (any case) and a 400 if not ("Derived from the linked shot."); a General task has none to give. The four text columns are copies kept in step on save and remain the only trace on an unlinked task.
* **Responses** add `shot_id`, `asset_id`, `sequence_id` (null when not linked). Filters `shot_id`, `asset_id`, `sequence_id` take an id or a code; `entity_type` and `entity_id` filter the text as before. Applying a template links the tasks it creates.
* **Migrations 0035 (columns, constraint) and 0036 (data).** 0036 links an existing task when it provably names a record of its own project: `entity_id` is a UUID of a record of that kind in the project (archived ones count), or, when it is not a UUID, exactly one record of that kind in the project has the id or the `entity_code` as its code. A UUID of another project, no match, several matches, an unknown type and a task without a project stay unlinked with their text untouched. **It does not refuse**: unlike 0025 it adds no constraint over the old text, so unlinked rows cannot make it fail; `report_production_data` lists them with a reason ("Tasks naming a record they are not linked to"). Reverse does nothing.
* **Effect on older tasks.** An unlinked task keeps working and can be edited as before, except that pointing it at something that does not exist is now a 400.
* **Not done:** a count of tasks per shot or asset in their own responses; moving the text columns out (final cleanup); episode as a link target (nothing in the data model named it).

## D-29 Versions: numbering, what they are about, publishing, the hero (WP E1 to E3, plan phase P9)

* **The server numbers versions (E1).** A series is the versions of a task, or, for versions with no task, of a shot or of an asset. Creating a version locks the series owner (task, shot or asset) and takes the highest `version_index` ever used in the series, soft-deleted versions included, plus one; `version_number` is `v` and the index padded to three digits. Concurrent creates get consecutive numbers (a race test with eight creates fails without the lock). A `version_number` sent on create is **ignored**, not refused: a client's guess is expected to lose races, and a 400 would only force a retry; on update it is read-only (400 if changed, echo fine). Numbers are never reused. The database holds it: unique `(task, index)`, and `(shot, index)` / `(asset, index)` for versions without a task.
* **A blank `code` is derived:** `<entity code>_<task type code or department>_V###`, upper case, `_2`, `_3` ... on a clash in the project. A code that is sent is kept and checked for clashes as before.
* **A version is about a shot or an asset, not both (E2).** Database check. A version made from a task alone takes the task's shot or asset; a shot or asset that disagrees with the task's is a 400, as is a shot on a task about an asset and the reverse. `entity_type` / `entity_id` / `entity_code` / `entity_name` are copies of the shot or asset kept in step on save; sending ones that disagree is a 400. A version linked to nothing keeps free text. **`project` is required** (it was nullable). Shot, asset and task are now `PROTECT`, and cannot be changed by editing the version.
* **Publishing (E3).** `publish` needs an **approved** version (400 otherwise; it does not approve), records `published_at` and `published_by`, and merges the body into `publishing_info` with the server's time (a `published_at` in the body is replaced). Publishing twice is a 400; `unpublish` of an unpublished version is a 400 and clears who and when. **A published version can change only its notes and tags** (400 naming the fields otherwise; a full PUT that echoes the current values is fine); archiving or deleting one is a 400 ("Unpublish it first"). The status fence of D-03 stays.
* **One hero per shot and per asset.** Promoting demotes the previous hero in the same transaction under a lock on the shot or asset (a race test with two promotions fails without the lock); the database allows one live hero per shot and per asset. A version of neither cannot be hero (400). Promotion still approves the version and is still subject to separation of duties (D-04).
* **Migrations 0037 (published_by, published_at), 0038 (data), 0039 (constraints).** 0038 **refuses, changing nothing,** when a version has both a shot and an asset, a shot or asset has several live heroes, or a version has no project that can be derived (its shot, asset and task name none, or different ones), and lists the rows; fix them and migrate again (the report lists the same rows beforehand). Otherwise it fills a missing project from the shot, asset and task when they agree, backfills `published_at` from `publishing_info["published_at"]` when that parses, and numbers each series: `version_index` takes the number in `version_number` when free in its series, and the rest get the next numbers in creation order. `version_number` text is never rewritten, so an old version may show "v002" with index 11. Reverse does nothing.
* **Not done:** hero per department or step (the plan says per shot); `Shot.current_version` stays derived as in D-16 (the hero does not feed it); bulk archive reports any other refusal as `blocked` but versions have no bulk endpoint.

## D-30 Reviews: the parts are rows (WP E4, plan phase P10)

* **Six tables replace the six JSON lists of a review** (`versions`, `reviewers`, `comments`, `notes`, `annotations`, `activity`): `ReviewItem` (a version on the review, in order), `ReviewParticipant` (user, name, role, verdict, notes, time), `ReviewComment` (author, text, frame, timecode, client visibility, tags, resolved at / by, a parent for replies), `ReviewNote`, `ReviewAnnotation`, `ReviewActivity` (append-only). Review responses **rebuild the same JSON shapes from the rows** (D-18 stands: the response shape does not change; each entry gains ids and a few fields, none is removed). The JSON columns stay on `Review` but are neither read nor written; they go in the contract phase (P12).
* **Authors come from the request.** A comment, note or annotation is written by the caller: `author` / `author_name` / `author_role` in the body are accepted (old clients send them) and **ignored**. A note's role is the caller's role on the project membership (empty for someone with none). The same rule applies to project notes (`/projects/{id}/notes/`): name and role are the caller's own, `author_avatar` is cleared. A note created with no user (a seed) keeps what it was given.
* **A verdict belongs to its participant.** `participant-verdict` is accepted only from the participant's own account (**403** otherwise). A participant row with no account (converted from the old list, which named people only by free text) can be answered by someone holding `review.approve`, because nobody else could. The id can be the row's id or the id the old list gave it (`legacy_id`). An approving verdict still goes through separation of duties (D-04). Each verdict adds an activity line (`PARTICIPANT_VERDICT`).
* **Appends cannot be lost.** Each comment, note, annotation or activity line is its own insert (the JSON list was read, appended and rewritten, so two at once kept one). Adding a version takes a lock on the review so positions are distinct (the test fails 4 out of 4 without it). Resolve and reopen record who and when.
* **New endpoints (additive):** `POST /reviews/{id}/participants/` (`user_id`, `role`; the user must be an active member of the review's project, a stranger and an unknown id answer the same 400; a user once per review), `DELETE /reviews/{id}/participants/{id}/`, `POST /reviews/{id}/versions/` (`version_id`: id or code of a version of the review's project; once per review), `DELETE /reviews/{id}/versions/{version_id}/`. All need `review.update` and project membership. `POST .../comments/` takes an optional `parent_id` (a reply to a first-level comment of the same review; a reply to a reply is a 400).
* **Migrations 0040 (tables) and 0041 (data).** 0041 reads the old lists leniently (their shape was never written down; **UNVERIFIED** against real data) and converts what it can: a version entry is an id or `{id|version_id|code}` that names a version of the review's project; a reviewer is an object whose `user_id` is looked up (an unknown one stays a name only); comments carry their replies, resolved flag and time. It **never refuses**: an entry it cannot read is printed and skipped, the JSON stays. `report_production_data` runs the same code as a dry run and lists those entries beforehand (information, not a finding). The seed commands run it too, so seeded reviews are not empty.
* **Not done:** the plan's `ApprovalRecord` as its own table (the activity rows and `StatusHistory` carry who approved what; a separate record would repeat them); `Note` unified with `ProjectNote` and tied to versions (project notes keep their text entity fields; they are the subject of the contract phase); who may add participants beyond `review.update`; closing a review does not lock its comments (not asked for).

## D-31 Asset archive guard and playlist entries as rows (WP C5 and E5, plan phase P11)

Two of the "later items" were chosen: C5 and E5. B6 (manual ordering), B8, C3 to C4 and C6, D7, F3 and F4 were not.

* **An asset that live shots use cannot be archived (C5).** Single delete, the `archive` action and `bulk-archive` refuse it, like a sequence with shots (D-13): a 400 "TREE is still used by 2 shots. Unlink it from them first." (`has_children` in bulk). Links to archived shots, and unlinked (soft-deleted) links, do not count. The asset's own children (`parent_asset`) are still not checked. Restoring is unchanged. The `versions` / `hierarchy` JSON and `Asset.version` are **not** derived yet (the other half of C5 is destructive and left for the contract phase).
* **Playlist entries are rows (E5).** `PlaylistEntry` (playlist, optional version, position, `legacy_id`, `extra`) replaces the JSON `entries`; responses rebuild the same list (`id`, `version_id`, `version_number`, `item_order`, the client's own extra keys, plus `legacy_id`). The JSON column stays, unread and unwritten, until P12.
* **Every route is checked now.** Before, only `add-entry` checked that a version belongs to the playlist's project: creating a playlist with `entries`, or `PATCH`ing `entries`, wrote whatever came. Now `entries` sent on **create** become rows through the same check (a version of another project, or an unknown one, is a 400 and the whole create is rolled back); on **update** `entries` is locked (400 "Use add-entry, remove-entry and reorder." unless the value equals what is stored, so an echo is fine). `add-to-playlist` on a version goes through the same service.
* **Positions.** The playlist row is locked while entries are added, removed or reordered, so concurrent adds get distinct positions (a race test with six adds fails 4 out of 4 without the lock). Removing leaves gaps. The same version may be on a playlist twice, as before; no constraint was added. An entry with no version (a placeholder) is allowed, as before.
* **Reorder changed:** the listed entries come first in the order given, **entries not listed now follow in their old order instead of being dropped** (the old code silently deleted them). An unknown, foreign or repeated id is a 400. `remove-entry` with an unknown id still changes nothing and answers 200.
* **`share_settings` is typed** on create and update (the known keys `is_public`, `allow_client_approval`, `require_passcode`, `client_id`, `expires_at` are validated as the `share` action does; other keys pass through).
* **Migrations 0042 (table) and 0043 (data).** 0043 never refuses: it converts entries in `item_order` order (an entry's other keys go to `extra`, its old id to `legacy_id`, so old ids keep working), and prints and skips an entry that names a version outside the playlist's project or is not an object. The shape of the old entries was never written down (**UNVERIFIED** against real data). `report_production_data` dry-runs it (information); the seeds convert too.
* **Not done:** the `Version.playlists` JSON cache (D-18) is still appended to by `add-to-playlist`; the playlist `activity` JSON; ordering of episodes, sequences and shots (B6).

## D-32 Contract phase: legacy columns dropped (plan phase P12)

Migrations **0044** (check) and **0045** (drop). No API response changes: every field below is still in responses, now read from where it really lives.

* **Dropped:** `Shot.sequence_code`, `Shot.current_version`, `Task.logged_hours`, `is_archived` on Task, Asset, Version, Playlist and Workflow, the six JSON lists on `Review` (`versions`, `reviewers`, `comments`, `notes`, `annotations`, `activity`) and `Playlist.entries`, plus the indexes on them. `sequence_code` in shot responses, filters (`sequence_code=`, `sequence=`, `sequence_id=` by code), search and the admin is read from the shot's sequence (`sequence__code`, a property on the model); `current_version` and `logged_hours` stay derived (D-15, D-16); `is_archived` stays derived from the soft delete (D-25). A `PATCH` that sends one of them is still a 400 unless it equals the derived value.
* **0044 refuses, changing nothing,** if 0045 would lose data: a review or playlist entry that never became a row (it first re-runs the conversion for reviews and playlists that have none, then dry-runs it; what is left is listed), a shot whose `sequence_code` text names no sequence of its project (it has no `sequence`), or a row with `is_archived` set that is still live (the flag has not been read since D-25; the seed commands used to set it). It lists the rows and says how to clear each. `Task.logged_hours` and `Shot.current_version` are dropped without a check: they were not read since D-15 and D-16 and a hand-typed `logged_hours` was announced as discarded there.
* **0045 is destructive.** Its reverse puts the columns back **empty** (defaults); the data in them is gone. Take a database backup first (DEPLOY.md). Reverse of 0044 does nothing.
* **`report_production_data` still works on a database that has not been migrated:** the sections about these columns read them with plain SQL while they exist and print nothing once they are gone.
* **The seed commands** no longer write the dropped columns; the review and playlist lists in the frontend mocks are turned into rows by the same conversion code as the migrations. A seeded "archived" mock row is simply live.
* **Not dropped, on purpose (each needs its own decision):**
  * `entity_type` / `entity_id` / `entity_code` / `entity_name` on Task, Version, Asset and others: for a row with no link (a General task, a version of neither a shot nor an asset, the tasks 0036 could not match) they are the only copy of the information.
  * `Project.total_*` (B8): nothing decided about deriving them.
  * The JSON caches on Version (`reviews`, `playlists`, `notes_list`, `activity`, `media_items`, `attachments`; D-18), `Asset.version` / `versions` / `hierarchy` (D-31), `Review.client` / `vendor`, the playlist `activity`.
  * `EditorialCut.sequence_code`, `ProjectNote`'s entity text, and `is_archived` on `deliveries` and the core lifecycle mixin (other apps).

## D-33 The assigned artist of a shot or asset is a project member (CR-34)

Same rule as a task's assignee, through the same validator. Only a new artist is checked, so an older record whose artist has left the project stays editable; clearing the artist is always allowed. Platform administrators pass the check as they do for tasks.

