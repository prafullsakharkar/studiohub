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
