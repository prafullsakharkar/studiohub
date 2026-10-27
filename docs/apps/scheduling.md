# Application: scheduling

Written against `docs/APP_ARCHITECTURE_TEMPLATE.md`. The authoritative detail is in
`docs/scheduling/` (`ANALYSIS.md`, `CONTRACTS.md`, `DECISIONS.md`, `PLAN.md`) and
`docs/delivery-pipeline/`. Status: **phases 9 to 11 done** (calendars, dates and integrity; bookings and capacity; authorization
and hardening). Phase 12 re-checks the app with the other two.

## 2. Application information

```text
Application: scheduling  (apps/scheduling)
Domain:      Studio calendar, bookable resources, leave, work calendars, project milestones
Purpose:     Say who is available when, how much of a week is booked, and which milestones a project has
Dependencies: core, identity (permissions), masterdata (departments, offices), production (projects, tasks)
Status:      In progress (feature/scheduling-improvement)
```

Scheduling imports nothing from Deliveries or Publishing, and Production imports nothing from
Scheduling (both checked by `tests/test_boundaries.py`). It reaches the delivery pipeline only through
the `deliveries.project_figures` provider (`apps/core/providers.py`).

## 3. Domain responsibility

**Owns:** work calendars (`WorkCalendar`), holidays, resources, bookings (`ResourceSchedule`), leave
(`ResourceLeave`), calendar events, milestones, and the capacity and overbooking figures.

**Does not own:** projects, tasks and their dates (Production; `Task.due_date` stays the single source),
departments and offices (Masterdata), deliveries (Deliveries; a milestone only holds a delivery's id).

## 4. What exists after Phase 11

| Piece | Where |
|---|---|
| Date arithmetic | `domain/calendar.py`, pure functions with no ORM: `is_working_day`, `working_days`, `week_bounds`, `week_bounds_for_date`, `working_hours`. DST weeks are 167 or 169 hours (`zoneinfo`). |
| Calendars | `services/calendar.py` (`WorkCalendarService`), `selectors/calendar.py` (`CalendarSelector`). A calendar has a time zone, working weekdays and hours per day. One is the default ("STUDIO", UTC, Mon-Fri, 8h, seeded by migration 0004); a resource with no calendar follows it. |
| Holidays | belong to a calendar; unique per calendar and date among live rows; optional holidays do not remove a working day. |
| Leave | `services/leave.py`: new requests count working days of the resource's calendar; `count_leave_days` (calendar days) stays for old rows. |
| Milestones | `services/milestone.py` (`MilestoneService`): Pending, In Progress, Completed; Completed only through `complete`, left only through `reopen`. A `delivery` milestone is validated through the provider. |
| Capacity | `selectors/capacity.py`: each resource's week is Monday to Monday in its calendar's time zone. `api/views/capacity.py` serves `capacity/`, `overbooking/`, `resolve-overbooking/` (moved from Production, same paths). |
| Time policy | `api/fields.py::StrictDateTimeField`: a date-time without `Z` or an offset is a 400. |
| Integrity | migration 0006: database checks on events, bookings, leave and rates; unique `upper(resource.code)`; `PROTECT` from resources to bookings and leave and from events to projects. |
| Bookings | `services/booking.py` (`BookingService.book`, `update`): the resource row is locked and an overlap is refused with 409 `booking_overlap`; the database holds the same rule (migration 0008). Booked, Blocked and Overbooked occupy time; Available does not; adjacent bookings are fine. |
| Capacity | after Phase 10, a week's capacity is the weekly figure scaled by available over usual working days: the calendar's holidays and the resource's Approved leave remove days. `CapacitySelector` (`resource_week`, `department_week`, `team_week`) is public through the `scheduling.capacity` provider. |
| Resource status | `selectors/resource_status.py`: shown as "On Leave" while an Approved leave covers today in the resource's calendar zone; writing "On Leave" is a 400. |
| Providers | `providers.py`, registered in `SchedulingConfig.ready`: `scheduling.project_milestones` (Production's schedule route) and `scheduling.capacity`. |
| Authorization | codes `schedule.manage` (bookings of any resource, leave for others, resources' creation, calendars, holidays, milestones), `schedule.approve` (decide leave) and the opt-in `schedule.sod.override` (decide one's own leave, with a reason); `services/access.py`. A matrix test pins seeded grants to enforced codes. |
| Leave rules | `services/leave.py`: own leave with `create`, others' with `manage` ("Unknown resource" otherwise); no overlapping pending or approved leave per resource (resource lock); no deciding one's own leave except with the override. |
| Side channels | notes and reasons cannot be searched or filtered; ordering by pay rate is ignored without `schedule.view_rates` (`api/filters.py`). |
| Audit | `services/audit.py` writes `scheduling` audit rows (leave decisions and overrides, default calendar changes, milestone completion, redaction); the change log tracks the scheduling models with notes, reasons, rates and event text excluded. |
| Bulk delete | `POST /schedules/bulk-delete/` (Q36). |
| Retention | `manage.py redact_leave_reasons [--older-than-years N] [--apply]` (Q37). |
| Report | `manage.py report_leave_days [--status S] [--limit N]`: read-only list of leave rows that would count differently as working days. |

Endpoints under `/api/v1/scheduling/`: `calendars/` (+ `set-default/`), `holidays/` (`?calendar_id=`),
`milestones/` (`?project_id=`, `complete/`, `reopen/`), plus the existing `resources/`, `schedules/`,
`leaves/`, `events/`. Lists stay bare arrays.

## 5. Rules worth knowing

* **Migration 0006 refuses to run** while a row would break a new check or two resource codes differ only
  in case. It changes nothing and lists the rows (up to 50 of each kind, deleted rows included). Count them
  first with query S2 (`docs/delivery-pipeline/ANALYSIS.md` section 8).
* **Old leave rows keep their count.** Only a new request, or an edit that changes the dates, is
  recounted in working days.
* **A calendar in use cannot be deleted** (409 `calendar_in_use`), nor can the default.
* **Milestones are narrowed to the caller's projects.** Another project's milestone answers 404, the same
  as an unknown id; a platform admin sees all.
* **After deploying Phase 11 run `manage.py init_platform`**: the new codes reach roles only then.
* The admin is read-only for bookings, leave, calendars and milestones (it would bypass the rules).
* **Overlaps are refused twice.** `BookingService` checks under a resource lock on every database; on PostgreSQL migration 0008 adds an exclusion constraint (`btree_gist`) so the admin or raw SQL cannot overlap either. Migration 0008 stops and lists existing overlapping pairs first. `docs/scheduling/BTREE_GIST.sql` is the script for installing the extension on a database that lacks it (check the live database first).
* Over-allocation (more booked hours than the week's capacity) is still allowed and reported; overlap in time is not.

## 6. Tests

`apps/scheduling/tests/`:

| File | Covers |
|---|---|
| `domain/test_calendar.py` | working days, holidays, custom weeks, week bounds in London, Los Angeles and Kolkata, both DST changes |
| `services/test_leave_days.py` | working-day counts, old rows unchanged, the report command |
| `services/test_capacity_week_zone.py` | per-resource weeks in the calendar's zone with a frozen clock |
| `api/test_time_policy.py` | naive date-times refused, offsets stored as UTC, bookings that end when they start |
| `api/test_calendars.py` | calendars, the default, holidays, resources |
| `services/test_booking_overlap.py` | the overlap rule, moving, editing old rows, what the refusal reveals |
| `concurrency/test_booking_pg.py` | PostgreSQL: eight concurrent bookings of one slot, exactly one wins |
| `services/test_capacity_leave_holidays.py` | capacity after holidays and leave, alerts, triage, `CapacitySelector` |
| `domain/test_week_capacity.py` | available days and scaled capacity (pure) |
| `api/test_resource_status.py` | derived status, both read paths, writing "On Leave" |
| `api/test_project_schedule.py` | Production's schedule route through the provider |
| `api/test_milestones.py` | scoping, status rules, delivery milestones with a stand-in provider, access |
| `migrations/test_phase9_migrations.py` | 0004 to 0007: seeding, stop-and-list, enforcement, reverse |
| `test_boundaries.py` | import boundaries and the moved capacity routes |

Run: `cd backend && uv run pytest apps/scheduling`.
