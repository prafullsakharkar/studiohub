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
| D-06 | **Q14: creator's role in a new project** | **O** | Interim: the creator gets a membership labelled "Production Admin" (platform admins none). The label is display only and grants nothing. **Still open:** which role (if any) a creator should hold, and whether a creator should be able to update their own project and manage its members. |
| D-07 | Role-to-code matrix | proposed | Below; seeded by `init_platform`, pinned by `tests/test_permission_matrix.py`. Needs your approval. |
| D-08 | `bulk-status` contract | A | Below. |

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

* Q14 (above) and Q1 to Q6, Q8 to Q12, Q15, Q16, Q18 to Q21 of `ANALYSIS.md` / `PLAN.md`.
* **Finding (UNVERIFIED at runtime):** `/scheduling/capacity/`, `/scheduling/overbooking/` and `/scheduling/resolve-overbooking/` are `IsAuthenticated` only and not scoped by project membership; `schedule.create/update/delete` are declared and seeded but nothing checks them. Same class as F-C1, not fixed here.
