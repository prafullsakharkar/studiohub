# Phase 10 — Scheduling: verification

Branch `sync/phase-10-scheduling` (from `develop` after the Phase 9 merge, `7f37ae65`), **not pushed, not merged**. No backend file changed. One backend request is proposed and **unapplied**: **CR-25** (the scheduling lists cannot be filtered). The screens work without it by narrowing the bare arrays in the browser.

## 1. Exit criteria

Plan: *resources (+ book/block), bookings grid (`schedules` + bulk-delete), leaves (+ approve/reject), holidays, work calendars (+ set-default), milestones (+ complete/reopen), events (+ update-status), capacity/overbooking/resolve; rates visibility; project Schedule/Calendar/Resources tabs.*

| Criterion | Result | Evidence |
|---|---|---|
| Resources, book/block | ✅ live | `scheduling.live` › a producer books a resource from its page; an overlapping booking is refused with the server's sentence ("This resource is already taken by booking …") and nothing is stored; an adjacent slot is accepted. Book and Block time open the booking form pre-filled (`POST /schedules/`, the same service as `/resources/{id}/book|block/`) |
| Bookings, bulk-delete | ✅ unit | a booking list with checkboxes posts `bulk-delete` and reports `1 deleted, 1 not found` from the 207 |
| Leave, approve/reject | ✅ live | an artist files leave without naming a resource (the server takes their own), cannot approve it (403, no button), a producer approves it from the list and the resource reads **On Leave**; a reject needs a reason |
| Holidays, work calendars (+ set default) | ✅ unit | Make default only on a non-default calendar; delete hidden for the default and a calendar in use |
| Milestones (+ complete/reopen) | ✅ live | Completed is reached only through `complete` (`PATCH status` is 400), left only through `reopen` (to In Progress) |
| Events (+ update-status) | ✅ unit | the form sends `start_time`/`end_time` with a zone (the old `start_date` form was a 400); status changes need `schedule.update` |
| Capacity, overbooking, resolve | ✅ live | this week's over-allocation (12 h booked of 8) shows as "4 h over"; Flag marks both bookings Overbooked; the alert stays, as the server defines it |
| Rates visibility | ✅ live + unit | the rate column exists only with `schedule.view_rates`; an artist reads their own resource's rate and gets `null` for Bob's |
| Project Schedule / Calendar / Resources tabs | ✅ unit | Schedule: dates + editable milestones (server-filtered by project); Calendar: the project's month; Resources: the production panel + links to the studio resources |

## 2. Quality gates

| Gate | Phase 9 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 90 files / 798 | **95 files / 882** |
| Live tests | 12 files / 72 | **13 files / 76** (the scheduling file is new; `production` 6 and `work` 7 re-run now because the project tabs changed) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 2272 warnings | **2 errors (the same two) / 2130 warnings**; the files changed here have 0 errors |
| Clean `git worktree` (symlinked `node_modules`) | typecheck 0, 798/798 | **typecheck 0, 882/882** |
| Net size (frontend, against `develop`) | | 45 files, +2,721 / −3,836 |

Mutation checks (break the code, expect a failure): the status-key of the leave/job tables, `milestone reopen` source state, the reject permission, leave types, the writable resource statuses, invented and removed interface fields on four row types (compile-time), the datetime conversion, month starting on Monday, midnight-ending events, leave status filter, the client-side filter for resources, the rate column gate, the approve gate, `canEdit` for leave, `canRemove` for calendars, the datetime kind of the booking form, the capacity Flag gate, the project calendar's event and leave filters, the bulk-delete route, the Book/Block gate, and the milestone project scope. Two were not caught and are not bugs: the event status actions are gated twice (a reader never sees them because the row actions need `schedule.update` anyway), and the first attempt at the resource filter mutation was malformed (redone and caught).

## 3. What was built

- **Typed API** (`src/api/scheduling/`): resources, bookings, leave, holidays, calendars, milestones, events, capacity; every row type pinned to the captured flow by an exhaustive key list; `schedulingFlow.ts` holds the rules (leave and milestone actions with the permission each needs, who can edit leave, which calendars can be deleted, which booking statuses occupy time). 51 contract tests against `samples/scheduling/_flow.json` (250 calls, four roles).
- **Screens** (`src/modules/scheduling/`, routes under `/scheduling/*`): Calendar (month of events, milestones, holidays and leave, with the chosen day's agenda), Resources (+ workspace with Details, Bookings, Leave, Changes), Bookings, Leave, Events, Milestones, Capacity, Holidays, Work calendars; a section nav above all of them.
- **Shared pieces:** a `datetime` field kind for forms (shows the browser's local time, sends a UTC instant with a `Z` — the API refuses a naive date-time) and `withClientFilters` (for lists whose server ignores a filter: the parameter is not sent, the rows are narrowed and recounted).
- **Project tabs:** Schedule shows the dates and an editable milestone list; Calendar replaces a 262-line mock shim (`calendarMilestonesFallback = []`); Resources keeps the production panel and adds links.

## 4. Removed (no silent deletions)

Separate commit `9fc1bb90` (14 files, −3,572 lines), all unreachable from `main.tsx` and imported by no test: `modules/scheduling` old `SchedulingWorkspace`, `CalendarMonthView`, `CalendarWeekView`, `CalendarDayView`, `CalendarTimelineView`, `ResourceGridView`, `ResourceCapacityView`, `ResourceUtilizationView`, `ResourceAssignmentsView`, `EventDetailModal`, `CreateEventModal`, `OverbookingAlertDrawer`, `useScheduling`, `SchedulingRepository`, `calendarHelpers`, `SchedulingPage`, `index`. Why: they read fields the API does not have (assignees, offices, skills, equipment specs, utilization), started on a hard-coded date (26 Aug 2026), posted an event body the API refuses (`start_date`), and clamped a resolved overbooking alert away locally although the server keeps it. Also rewritten in place: `ProjectCalendarTab` (mock shim), `ProjectScheduleTab`, `ProjectResourcesTab`.

Left alone: the legacy scheduling types in `types/production` (shared file, other readers).

## 5. Findings (details in `backend-change-requests.md`, "Phase 10 findings")

1. **CR-25 (proposed)** — every scheduling list ignores nearly every filter (resources: type, status, department, calendar; bookings: resource, status; leave: status, resource, type; events: project, type, status and any date window; milestones: status, kind, project by code); event rows have `project_name` but no project id; `resolve-overbooking` answers an unknown alert with `{"detail": "['Unknown overbooking alert.']"}`; a bad `start`/`end` window answers a bare list. The screens filter in the browser; a calendar loads every event.
2. **An artist can create an event but not change, re-status or delete it** — not even their own (`schedule.update` / `schedule.delete`). The screens follow the matrix and offer them nothing; this may not be what the studio wants (Q-20).
3. **A create answers with the fields that were sent** (plus `id`), not the stored row (resources and events): the screens go to the row's page / the list instead of rendering the response.
4. **Milestone `status` on create is ignored** (always Pending), and a leave of only non-working days counts 0.
5. **Capacity and overbooking describe this week only**; the alert stays after "resolve" (which only flags the bookings). The page says so.
6. **My own slips this phase:** the first capture used a department path and body that did not exist (the recorded 404/400 showed it), the first overbooking capture used fixed November dates although the endpoint reads the current week, the first calendar used ARIA grid roles on plain elements (Biome refused it; now a table), the first live runs read permission-gated controls before the user had loaded (now awaited), and one mutation script that matched nothing printed "caught" (checked by hand and redone).

## 6. Deferred / not done

- **Week, day and timeline views, drag-to-book, resource grid by day.** The old views were built on invented data. The new calendar is a month plus the chosen day's agenda; bookings are a list and a per-resource tab.
- **Utilization over time / forecasting.** The server gives this week only (`capacity/`).
- **Booking window filters** (`start`/`end`) in the bookings list: the server supports them, the list has no date inputs yet.
- **Linking a booking to an event or task** from the form (the API accepts `event` and `task`).
- **Delivery milestones** are created with a pasted delivery id; there is no picker over the project's deliveries.
- **Leave cancel** has no endpoint (a pending request is edited or deleted).
- The Phase 6 to 9 deferrals stand.

## 7. Questions for the owner

1. **CR-25** — approve the list filters (as for deliveries CR-17 and publishing CR-22), add event `project_id` to the rows, and tidy the two error bodies? Without it the screens keep filtering in the browser.
2. **Q-20** — should an artist be able to edit, re-status or delete the events they create? Today the seeded matrix says no (`schedule.update` / `delete`); granting `schedule.update` would also let them edit resources.
