# Scheduling decisions

Cross-app decisions (Q1-Q4, Q6-Q12) are in `docs/delivery-pipeline/DECISIONS.md`. Earlier scheduling decisions made during the production work are in `docs/production/DECISIONS.md` **D-09, D-20, D-21, D-22** and still stand. Status: **ANSWERED**, **ASSUMED** ("your call"), **OPEN**, **DEFERRED**.

| Q | Question | Answer | Date | Status | Affects |
|---|---|---|---|---|---|
| Q5 | Scope | **Now:** time-zone policy; holiday calendars; milestones; booking overlap policy; utilization derived through a selector (masterdata Phase 6 waits for it); production `Task.due_date` as the single source of truth for task dates. **Later:** dependencies with cycle checks; recurring events; reminders. **Not:** Gantt-style task planning inside Scheduling. | 2026-10-27 | ASSUMED | Phases 9-11 |
| Q11 | Scoping | Resources, holidays and calendars are studio-wide; bookings and events tied to a project follow project membership (as D-21 already does for events). | 2026-10-27 | ASSUMED | Phase 11 |
| Q19 | Leave for others | **A.** Own leave with `schedule.create`; others with `schedule.manage`. Closes D-20's open point. | 2026-10-27 | ASSUMED | DOM-SCH-05 |
| Q20 | Leave days | **A.** Working days for new requests once calendars exist; old rows not recomputed. | 2026-10-27 | ASSUMED | DOM-SCH-05 |
| Q21 | Holiday calendars | **A.** `WorkCalendar` default plus one per office. | 2026-10-27 | ASSUMED | DOM-SCH-01, 02 |
| Q22 | Invented project milestones | **A.** `Milestone` rows; Production's route reads them through a provider. | 2026-10-27 | ASSUMED | DOM-SCH-06, API-SCH-11 |
| Q23 | Audit target types | **A.** `scheduling` target added; scheduling models join the change log. | 2026-10-27 | ASSUMED | Phase 9 |
| Q24 | On-delete rules | **A.** Bookings and leave `PROTECT` from resources; event project `PROTECT`. | 2026-10-27 | ASSUMED | Phase 9 |
| Q27 | Milestone Completed guarded | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-SCH-06 |
| Q28 | `schedule.sod.override` for leave | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-SCH-05 |
| Q31 | Time and date policy | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | CONTRACTS §1 |
| Q32 | Booking overlap (supersedes D-22's overlap rule) | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-SCH-04 |
| Q33 | `Resource.status` derived | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-SCH-03 |
| Q34 | Codes and role matrix | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | `PLAN.md` §6 |
| Q35 | Sensitive fields | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | SEC-SCH-01 |
| Q36 | Bulk contract (`bulk-delete`) | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | API-SCH-14 |
| Q37 | Leave-reason retention | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | |

Full text of Q25-Q38: `docs/delivery-pipeline/DECISIONS.md`. Phase 1 analysis: `ANALYSIS.md`. Design: `CONTRACTS.md`, `PLAN.md`.

## While implementing

Phase 9 (2026-10-27). Numbers continue the shared list in `docs/delivery-pipeline/DECISIONS.md`; full text is there.

| # | Date | Assumption | Status | Affects |
|---|---|---|---|---|
| A-43 | 2026-10-27 | `feature/scheduling-improvement` starts from the deliveries tip (`66649be`), not `develop` | ASSUMED | branch |
| A-44 | 2026-10-27 | Calendar default, fallback and recreation: with no default row the built-in rules (UTC, Mon-Fri, 8h) apply, and creating a holiday recreates the default | ASSUMED | `selectors/calendar.py`, `services/calendar.py` |
| A-45 | 2026-10-27 | Calendar and milestone writes use `schedule.update` / `create` / `delete` until Phase 11 adds `schedule.manage` | ASSUMED | `api/viewsets` |
| A-46 | 2026-10-27 | Leave overlap and the other leave rules wait for Phase 11 | ASSUMED | DOM-SCH-05 |
| A-47 | 2026-10-27 | A leave with no working day is allowed and counts 0 | ASSUMED | `services/leave.py` |
| A-48 | 2026-10-27 | Reopening a milestone returns it to In Progress | ASSUMED | `services/milestone.py` |
| A-49 | 2026-10-27 | Calendars and milestones are view-only in the admin | ASSUMED | `admin/scheduling.py` |
| A-50 | 2026-10-27 | Event and resource create responses now carry `id` | ASSUMED | serializers |

Phase 10 (2026-10-27):

| # | Date | Assumption | Status | Affects |
|---|---|---|---|---|
| A-51 | 2026-10-27 | Superseded by A-57: Q32 ran as option B for part of Phase 10, on a wrong finding about `btree_gist` | SUPERSEDED | |
| A-52 | 2026-10-27 | Overbooked bookings occupy time like Booked and Blocked | ASSUMED | `services/booking.py` |
| A-53 | 2026-10-27 | Capacity is scaled by available/usual working days, not capped at working days times hours per day | ASSUMED (differs from CONTRACTS DOM-SCH-03 as proposed) | `domain/calendar.py`, `selectors/capacity.py` |
| A-54 | 2026-10-27 | Only Approved leave reduces capacity or shows "On Leave" | ASSUMED | selectors |
| A-55 | 2026-10-27 | Existing overlapping rows are left; `?status=` still filters the stored column; the admin can still write overlaps (Phase 11) | ASSUMED | |
| A-56 | 2026-10-27 | Provider names `scheduling.project_milestones` and `scheduling.capacity`; the dashboard card keeps deriving its own milestones | ASSUMED | `providers.py` |
| A-57 | 2026-10-27 | Q32 is option A as designed: service lock plus the PostgreSQL exclusion constraint (migration 0008). User: "Option 2, add the constraint and commit" | ANSWERED (user) | `migrations/0008_booking_exclusion.py`, `services/booking.py` |

Phase 11 (2026-10-27):

| # | Date | Assumption | Status | Affects |
|---|---|---|---|---|
| A-58 | 2026-10-27 | Replaces the interim gates of A-45: calendar, holiday and milestone writes, bookings, book and block need `schedule.manage`. **Resource creation also moves to `schedule.manage`** (it was `create`), because lead-artist and artist now hold `create`; otherwise they could create resources | ASSUMED | `api/viewsets` |
| A-59 | 2026-10-27 | Editing a pending leave needs `schedule.create` (own) or `schedule.manage`; deleting stays `schedule.delete`. No `cancel` endpoint is built (the contract's service list had one, its API table did not) | ASSUMED | `api/viewsets`, `services/leave.py` |
| A-60 | 2026-10-27 | Bookings and leave are searchable by resource name and code; notes and reasons are not. The contract only said the hidden fields are not searchable | ASSUMED | SEC-SCH-01 |
| A-61 | 2026-10-27 | The override reason a person gives for deciding their own leave is stored in the audit row's metadata (it explains the override; it is not a leave reason). Leave overlap has no database constraint: the resource lock decides races | ASSUMED | `services/leave.py` |
| A-62 | 2026-10-27 | Bookings and leave are view-only in the admin, like calendars and milestones | ASSUMED | `admin/scheduling.py` |
| A-63 | 2026-10-27 | Q37 retention: N = 3 years, command run by hand, never scheduled; blanks both reason columns of decided leave, deleted rows included | ASSUMED (Q37 default) | `redact_leave_reasons` |

