# Scheduling contracts

Phase 2 target design, 2026-10-27. Status: **PROPOSED**; items marked *(Qnn)* follow the recommended answer of an open Phase 2 question. Production decisions **D-09, D-20, D-21, D-22** stand and are built on, not reopened. Cross-app rules: `docs/delivery-pipeline/CONTRACTS.md`. Audit: `ANALYSIS.md`. Order of work: `PLAN.md`.

**What the app is after this work** (Q5, Q19-Q22): the studio calendar, bookable resources with bookings that cannot double-book a resource, leave with own-request and approval rules, **work calendars** (time zone, working week, holidays per office), **project milestones** replacing Production's invented ones, and capacity figures that account for leave and holidays. Task dates stay in Production (`Task.due_date`, the single source). Dependencies, recurring events and reminders are LATER (Q5).

## 1. Time and date policy *(Q31)*

| Kind of value | Stored as | Example |
|---|---|---|
| A moment (event, booking start/end) | `DateTimeField`, UTC (`USE_TZ=True`, `TIME_ZONE="UTC"`) | `2026-11-02T09:00:00Z` |
| A day (leave, holiday, milestone due date, all-day event) | `DateField`, meaning the day **in the calendar's time zone** | `2026-12-25` |
| A week (capacity) | computed: Monday 00:00 to next Monday 00:00 **in the calendar's time zone**, converted to UTC for the query | |

* The API accepts ISO 8601 with an offset or `Z`; a naive date-time is a 400 (today it is taken as UTC silently). Responses are UTC with `Z`.
* Working-day arithmetic lives in one module, `apps/scheduling/domain/calendar.py` (pure functions, no ORM): `is_working_day(calendar, day)`, `working_days(calendar, start, end) -> int`, `week_bounds(calendar, instant) -> (start_utc, end_utc)`, `working_hours(calendar, start_utc, end_utc) -> Decimal`. Holidays are passed in by a selector, so the functions test without a database.
* DST: a week that crosses a DST change is 167 or 169 hours long; `week_bounds` uses `zoneinfo`, never fixed offsets. Tests freeze the clock on both European and US change dates.

## 2. Domain contracts

### DOM-SCH-01 `WorkCalendar` (new, table `scheduling_work_calendar`, studio-wide) *(Q21 = A)*

| Field | Rule |
|---|---|
| base | `EntityModel` |
| `code` | unique `upper(code)` over all rows |
| `name` | Char 255 |
| `time_zone` | IANA name, validated against `zoneinfo.available_timezones()`; default from the office's `timezone` when `office` is set |
| `office` | FK `masterdata.Office`, `PROTECT`, nullable, unique among live rows (one calendar per office) |
| `working_weekdays` | JSON list of ISO weekdays, default `[1,2,3,4,5]`; 1 to 7 distinct values |
| `hours_per_day` | Decimal(4,2), `> 0`, `<= 24`, default 8 |
| `is_default` | at most one live default (partial unique); migration creates "Studio" (UTC, Mon-Fri, 8h) as the default |

### DOM-SCH-02 `Holiday` (existing)

New `calendar` FK (`PROTECT`). Migration attaches every existing holiday to the default calendar, then replaces `unique_together(holiday_date)` with unique `(calendar, holiday_date)` among live rows. `is_paid`, `is_optional` keep their meaning; an optional holiday does **not** remove a working day in arithmetic (documented, test).

### DOM-SCH-03 `Resource` (existing)

| Field | Today | Target |
|---|---|---|
| `calendar` | none | FK `WorkCalendar`, `PROTECT`, nullable; null means the default calendar |
| `status` | typed (Active, On Leave, Unavailable) | **derived** in responses: "On Leave" when an approved leave covers today in the resource's calendar, otherwise the stored value if "Unavailable", otherwise "Active"; writing "On Leave" is a 400; the stored column is kept, read-only for that value (*Q33*) |
| `hourly_rate_usd` | no lower bound | DB check `>= 0`; serializer `min_value=0` |
| `capacity_hours_per_week` | PositiveInt | kept; when the calendar is known, capacity per week = `working days in that week × hours_per_day`, capped by this value (*Q31*) |
| `code` | unique case-sensitive at DB | DB constraint `upper(code)` (D-22 checks in the service already) |

### DOM-SCH-04 `ResourceSchedule` (booking, existing) *(Q32 = A)*

* **No overlap for a resource**: two live bookings of the same resource with status in (Booked, Blocked) may not overlap in time. Enforced twice:
  1. service: inside `transaction.atomic()`, lock the resource row (`select_for_update`), query for an overlapping live booking, refuse with 409 `booking_overlap` naming the other booking's id (and its title only if the caller may see it, D-21);
  2. PostgreSQL: `ExclusionConstraint` on `(resource_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)` where `status IN ('Booked','Blocked') AND NOT is_deleted`. Needs the `btree_gist` extension (created in the migration with `CREATE EXTENSION IF NOT EXISTS btree_gist`; **UNVERIFIED** whether the application role may create it, see `DECISIONS.md` checks). On SQLite the migration operation is skipped (vendor check) and the service check alone applies.
* **Over-allocation** (more booked hours in a week than capacity) stays allowed and reported (D-09, `Overbooked` status, `resolve_overbooking`), now with leave and holidays reducing capacity.
* Adjacent bookings (`[)` ranges) do not overlap: 09:00-12:00 and 12:00-15:00 are fine.
* `Available` slots never block.
* DB checks: `end_time > start_time` (bookings), `end_time >= start_time` (events), `end_date >= start_date` (leave).
* `resource` on-delete `PROTECT` (Q24); bookings keep their history.
* Migration refuses, changing nothing, while overlapping live Booked/Blocked pairs exist, and lists them (staging query S1 counts them first).

### DOM-SCH-05 `ResourceLeave` (existing, D-20 stands) *(Q19 = A, Q20 = A)*

* **Own leave for everyone:** a leave for the caller's own resource needs `schedule.create`; for anyone else's resource `schedule.manage` (new). Editing a pending request follows the same rule; moving a request to another resource is a 400 (create a new one).
* **Days counted as working days** of the resource's calendar (weekends and non-optional holidays excluded); `total_days` stays a server-computed column. Existing rows are **not** recomputed (their counts stay as approved); a report command lists rows whose working-day count would differ.
* Overlapping pending or approved leave for the same resource is a 400.
* Decisions need `schedule.approve` (new; seeded to the roles that hold `schedule.update` today, so nobody loses the ability). Not deciding your own leave stays (D-20). Override for single-manager studios: `schedule.sod.override` + reason, seeded to no role.
* `resource` on-delete `PROTECT`.
* `reason` and `rejection_reason`: excluded from search, filters and ordering for everyone (SCH-01 fix; searching for text you may see is lost too, which keeps the rule simple).

### DOM-SCH-06 `Milestone` (new, table `scheduling_milestone`) *(Q22 = A)*

| Field | Rule |
|---|---|
| base | `EntityModel` |
| `project` | FK `production.Project`, `PROTECT` |
| `name` | Char 255; unique `(project, upper(name))` among live rows |
| `due_date` | Date (project's default calendar zone) |
| `status` | Pending, In Progress, Completed (the three values today's invented list uses); Completed sets `completed_at`, `completed_by`; Completed is left only with `schedule.manage` |
| `order` | PositiveInt, for display |
| `kind` | `general`, `delivery` |
| `delivery_package_id` | UUID, nullable, **no FK** (Scheduling must not depend on Deliveries, X-01); checked at write time through the `deliveries.project_figures` provider ("a delivery of this project"); `kind=delivery` requires it |
| `notes` | Text |

Production's `GET /organizations/projects/{id}/schedule` returns `{project_id, start_date, delivery_date, milestones}` built from these rows through the provider (X-05): same keys per milestone as today (`name`, `date`, `status`, plus `id`); a project with no milestones returns `milestones: []` instead of the five invented phases.

### DOM-SCH-07 `CalendarEvent` (existing, D-21/D-22 stand)

Additions only: DB check on times, `project` on-delete `PROTECT` (Q24), naive date-times refused (§1). `event_type="Milestone"` events stay as they are (calendar entries); real milestones are DOM-SCH-06.

## 3. Services (signatures)

```python
# apps/scheduling/services/calendar.py
class WorkCalendarService:
    create(*, actor, data) -> WorkCalendar
    update(*, actor, calendar, data) -> WorkCalendar
    set_default(*, actor, calendar) -> WorkCalendar

# apps/scheduling/services/booking.py (replaces book_resource / block_resource)
class BookingService:
    book(*, actor, request, resource, start, end, status="Booked", event=None, task=None, notes="") -> ResourceSchedule
    move(*, actor, request, booking, start, end) -> ResourceSchedule
    cancel(*, actor, request, booking) -> None

# apps/scheduling/services/leave.py (existing approve/reject kept)
class LeaveService:
    request(*, actor, request, resource, data) -> ResourceLeave
    update(*, actor, request, leave, data) -> ResourceLeave
    approve(*, actor, leave, override_reason=None) -> ResourceLeave
    reject(*, actor, leave, reason, override_reason=None) -> ResourceLeave
    cancel(*, actor, leave) -> ResourceLeave

# apps/scheduling/services/milestone.py
class MilestoneService:
    create(*, actor, request, data) -> Milestone
    update(*, actor, request, milestone, data) -> Milestone
    complete(*, actor, milestone) -> Milestone
    reopen(*, actor, milestone) -> Milestone

# apps/scheduling/selectors/capacity.py (public, also used by Masterdata Phase 6 through a provider)
class CapacitySelector:
    resource_week(resource_id, week_start) -> CapacityFigures
    department_week(department_id, week_start) -> CapacityFigures      # utilization for Masterdata
    team_week(team_id, week_start) -> CapacityFigures
```

## 4. API contracts

Under `/api/v1/scheduling/` unless stated. Lists stay **bare arrays** (frontend contract).

| ID | Endpoint | Before | After | Client impact |
|---|---|---|---|---|
| API-SCH-01 | `GET /schedules/?search=`, `GET /leaves/?search=` | matches hidden notes / reasons (SCH-01) | `notes`, `reason` not searchable | searching for a reason finds nothing |
| API-SCH-02 | `GET /resources/?ordering=hourly_rate_usd` | allowed without `view_rates` (SCH-02) | ignored (default order) without `view_rates` | |
| API-SCH-03 | `POST/PATCH /leaves/` | anyone's resource | own resource with `schedule.create`; others need `schedule.manage` (400 "Unknown resource." otherwise, no oracle) | artists can request their own leave once seeded |
| API-SCH-04 | `POST /leaves/{id}/approve|reject/` | `schedule.update` | `schedule.approve`; body `rejection_reason` or `reason` | none for seeded roles |
| API-SCH-05 | `POST /schedules/`, `POST /resources/{id}/book/`, `PATCH /schedules/{id}/` | overlaps allowed | 409 `booking_overlap` | planners see refusals they did not before |
| API-SCH-06 | `GET /schedules/` | unbounded | optional `start` / `end` window filters (overlap semantics); default unchanged | none |
| API-SCH-07 | `GET /resources/` | typed `status` | derived `status`; new `calendar_id` | "On Leave" appears without anyone typing it |
| API-SCH-08 | `/calendars/` | — | new CRUD (studio-wide), `schedule.manage` for writes | new |
| API-SCH-09 | `/holidays/` | one per date | `calendar_id` (defaults to the default calendar); unique per calendar and date | old clients keep working against the default calendar |
| API-SCH-10 | `/milestones/` | — | new; project-scoped; `complete`, `reopen` actions | new |
| API-SCH-11 | `GET /organizations/projects/{id}/schedule` (Production route) | invented phases | real milestones, same keys, empty list when none | projects show no milestones until someone creates them |
| API-SCH-12 | `/scheduling/capacity|overbooking|resolve-overbooking/` | served by Production | served by Scheduling at the **same paths**, same codes and shapes (X-05); capacity now subtracts leave and holidays | numbers drop in leave and holiday weeks |
| API-SCH-13 | Date-times without offset | taken as UTC | 400 *(Q31)* | clients must send `Z` or an offset. The frontend's event form sends `start_date` / `end_date` days, not `start_time` / `end_time` (`modules/scheduling/components/CreateEventModal.tsx:87-88`, posted unchanged by `SchedulingRepository.ts:20`), so its event create is likely already a 400 today (**UNVERIFIED**, not run); this rule does not change that |
| API-SCH-14 | `POST /schedules/bulk-delete/` | — | new, Q36 contract (planners clearing a week) | new |

## 5. Authorization

| Action | Code | Extra |
|---|---|---|
| read calendar, resources, bookings, leave, holidays, milestones | `schedule.view` | events by visibility (D-21); bookings masked (D-21); milestones by project membership |
| rates, e-mail | `schedule.view_rates` | own resource always (D-21) |
| create own leave, own events | `schedule.create` | |
| leave for others, bookings of any resource, calendars, holidays, milestones | **`schedule.manage`** (new) | milestones need project membership |
| edit events, resources | `schedule.update` | as today |
| approve / reject leave | **`schedule.approve`** (new) | not your own (D-20) |
| delete | `schedule.delete` | |
| decide your own leave | **`schedule.sod.override`** (no role) | reason |

Role matrix proposal: `PLAN.md` §6.

## 6. Security contracts

| ID | Contract |
|---|---|
| SEC-SCH-01 | Hidden values (leave reasons, out-of-scope booking notes, rates without the code) cannot be read back through search, filters or ordering (test per field). |
| SEC-SCH-02 | Nobody files leave for, or books, someone else without `schedule.manage`. |
| SEC-SCH-03 | Nobody decides their own leave without the override (D-20 plus override). |
| SEC-SCH-04 | Two concurrent bookings of the same slot: exactly one wins (PostgreSQL test). |
| SEC-SCH-05 | Logs never contain leave reasons, notes or rates. |

## 7. Audit events

Scheduling models join the change log (`apps/audit/signals/change_tracking.py`), with `reason`, `rejection_reason`, `notes`, `hourly_rate_usd` masked; `AuditLog` target `scheduling` (Q23) for leave decisions, overrides, calendar default changes and milestone completion.

## 8. Failure behaviour

| Case | Answer |
|---|---|
| Overlapping booking | 409 `booking_overlap` |
| Overlapping leave | 400 |
| Naive date-time, end before start | 400 |
| Unknown / foreign resource, task, event, project, calendar | 400 "Unknown ..." (D-22 wording) |
| Lost race on a booking or a leave decision | 409 / 400 as today for leave (D-20 keeps 400) |
| Unknown IANA zone | 400 |
