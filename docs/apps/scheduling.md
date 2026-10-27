# Application: scheduling

Written against `docs/APP_ARCHITECTURE_TEMPLATE.md`. The authoritative detail is in
`docs/scheduling/` (`ANALYSIS.md`, `CONTRACTS.md`, `DECISIONS.md`, `PLAN.md`) and
`docs/delivery-pipeline/`. Status: **phase 9 done** (calendars, dates and integrity). Phase 10
(bookings and capacity) and Phase 11 (authorization and hardening) are not built; Phase 12 re-checks
the app with the other two.

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

## 4. What exists after Phase 9

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
* **Interim write gates** (A-45): calendars and milestones use `schedule.update` / `create` / `delete`
  until Phase 11 adds `schedule.manage` and `schedule.approve`.
* Capacity does not yet subtract leave and holidays, and bookings may still overlap (Phase 10).

## 6. Tests

`apps/scheduling/tests/`:

| File | Covers |
|---|---|
| `domain/test_calendar.py` | working days, holidays, custom weeks, week bounds in London, Los Angeles and Kolkata, both DST changes |
| `services/test_leave_days.py` | working-day counts, old rows unchanged, the report command |
| `services/test_capacity_week_zone.py` | per-resource weeks in the calendar's zone with a frozen clock |
| `api/test_time_policy.py` | naive date-times refused, offsets stored as UTC, bookings that end when they start |
| `api/test_calendars.py` | calendars, the default, holidays, resources |
| `api/test_milestones.py` | scoping, status rules, delivery milestones with a stand-in provider, access |
| `migrations/test_phase9_migrations.py` | 0004 to 0007: seeding, stop-and-list, enforcement, reverse |
| `test_boundaries.py` | import boundaries and the moved capacity routes |

Run: `cd backend && uv run pytest apps/scheduling`.
