# Phase 26: week, day and timeline views on the scheduling calendar: verification

Branch `sync/phase-26-scheduling-views` (from `develop` at `1cdef773`, so it does not yet contain CR-37 or the CI job; it merges cleanly: it touches only `frontend/src/modules/scheduling`, one live test and this report), **not pushed, not merged**. **No backend file was touched.**

The owner asked for it ("then scheduling views"); it was the first item of the deferred list since Phase 10, where the old week, day and timeline views were deleted because they were built on invented data.

## 1. What the server already offered (no backend change needed)

| Need | Evidence |
|---|---|
| Bookings for a window | `ResourceScheduleSelector.get_queryset` applies `start` / `end` (`end_time > start`, `start_time < end`), and the list is a bare array (no paging). `BookingFilterSet` does **not** list them, which is why I read the selector: the filter set's docstring says bookings have the window, and they do, through the selector. A bare date-time is a `400` (captured in Phase 10: `schedules_window_naive`); the live test checks it again |
| Events and leave for a window | `EventFilterSet`, `LeaveFilterSet` (events: instants with a zone; leave: plain days), already used by the month |
| Resources, and which work calendar each uses | `ResourceRow.calendar` |
| Holidays, and which calendar each belongs to | `Holiday.calendar` (a holiday is a calendar's, so a timeline row is shaded only by the holidays of **its own** calendar) |
| Permissions | every scheduling read is `schedule.view`, the same as the month, so the timeline needs no new gate; booking from it needs `schedule.manage`, the form's own gate |

## 2. What it is

The calendar (`/scheduling`, and a project's Calendar tab) has a view switcher: **Month** (unchanged), **Week**, **Day**, **Timeline** (the studio calendar only; a project has no timeline, resources are the studio's).

- **Week and Day** (`TimeGrid`): the days side by side; an all-day band on top (all-day events, milestones, holidays, leave); the timed events over 24 hours at their clock time. Events that overlap sit side by side (`placeTimed`); a very short one is drawn at least 20 minutes tall; one that crosses midnight is clipped to each day. The grid opens an hour before the first event shown, else at 08:00. An event links to its edit form for someone who may change events (`schedule.update`), else it is plain.
- **Timeline** (`TimelineView`): resources down, two weeks across (Monday of the chosen week). A bar per booking over the days it covers (cyan Booked, grey Blocked, red Overbooked, indigo anything else); bookings of one resource that overlap stack in lanes; leave (approved or pending) shades that resource's days amber, the holidays of its own calendar shade them green, weekends are dimmed; a booking clipped by the window has a square edge on that side. A filter narrows the rows by name, code or department. Each row has **Book <chosen day>**, which opens the booking form prefilled for the chosen day (9:00 to 17:00): there is **no drag-and-drop**, so no write happens on this page. A booking links to its form for `schedule.manage`.
- **State** is in the address (`?view=week&date=2026-11-04`) on the page, so a view can be linked and survives a reload; an unknown view or an impossible date (`2026-02-31`) falls back to the month and today. Inside a project tab, whose address carries other state, it is local to the component.
- **Windows:** each view asks the server for exactly what it shows (month: the grid; week; day; timeline: the two weeks), as instants **with a zone**; the timeline's resources and bookings are read only on the timeline.

Files: `calendarModel.ts` (pure: `weekOf`, `addDays`, `windowOf`, `placeTimed`, `layoutBars`, `positionIn`, `leaveDaysByResource`, `holidaysByCalendar`, `dayAgenda`), `TimeGrid.tsx`, `TimelineView.tsx`, `kinds.ts`, `CalendarPage.tsx` (the shell). Net: 8 files, +1,148 / −58.

## 3. Evidence

| Check | Result |
|---|---|
| Model tests (`calendarModel.test.ts`) | **27** (was 6): week across month and year ends; the window as local-midnight instants with a zone; lanes (overlap, chains, touching items, a follower of an overlapping pair keeps the full width, midnight clipping, minimum height, nonsense ignored); bars (position as a share of the row, multi-day, lanes per resource, clipping flags, outside and empty ones left out, minimum width, positions on day columns, clamping); leave and holidays per resource and per calendar; a day split for the grid |
| View tests (`calendarViews.test.tsx`, built from the captured events, bookings, resources, leave and holidays) | **15**: the address and its fallbacks, stepping and Today, the window asked for (with a zone, and no bookings request outside the timeline), a timed event once in its day and an all-day event in the band, one column for a day, links only for those who may change events, an empty day, the timeline's window, rows and bars with lanes, Book and booking links by permission, the day chosen is the day Book proposes, leave and holiday shading by resource and calendar (and leave wins), the filter, "New event" not on the timeline, a project calendar without a timeline and keeping its state out of the address |
| Mutations | **model: 15 run, 14 caught at once, 1 survivor** (a follower of an overlapping pair was needlessly half-width) fixed by a new test and then caught; **components: 17 run, 13 caught at once, 3 survivors** (an impossible date accepted; "New event" on the timeline; a holiday shading every resource, which a long leave hid in the captured data) each exposed a weak test, fixed and then caught; **1 equivalent** (the grid's initial scroll position, not observable in jsdom). My model commit message says 16: it was 15 |
| Live (real backend, fresh seed), `scheduleViews.live` | **4 of 4**: the server returns one of a resource's two bookings for the week's window and both unfiltered, and refuses a bare date-time with 400; the timeline draws one bar (the booking two months away is not drawn) and the page's real request carries the exact two weeks with a zone; the week puts the event on its day and not the far one; the far booking shows in its own two weeks. **One live mutation first survived** (dropping the window's `end`: the timeline clips to its days anyway, so the bar count could not show it) and led to the test reading the request; then caught |
| Gates | `tsc` 0; **107 files / 1,085 tests** (+36: 21 model, 15 views); build OK; Biome **0 errors, 801 warnings** (unchanged; five I added were fixed: `role="group"` became `<article>` and `<fieldset>`, and typed rows in the test); nothing new unreachable |
| Role smoke | **7 of 7** (42.8 minutes: slow, with two route reloads, `/projects` and `/scheduling`, each `ERR_NETWORK_CHANGED` and each recovered on the first reload). This branch has the earlier version of the spec (blank pages only); the error-boundary reload is on `develop` |

## 4. Limits, stated plainly

- **Read-only.** Nothing is dragged, resized or created on the grid. "Book" and "New event" open the existing forms.
- **No "now" line** on the grid (it would make the tests depend on the clock).
- **Daylight saving.** The grid shows 24 clock hours on every day, including the 23- and 25-hour ones; bars on the timeline are positioned by day column, so a change of clocks never moves a booking to another day. A time that does not exist (02:30 on the spring-forward day) is drawn where the browser puts it.
- **Resources and leave are read in full** (small, studio-wide lists, as the month already read leave); only bookings and events are windowed.
- **The timeline shows bookings and leave, not capacity** (the capacity page keeps that, and the server's capacity is this week only).
- **Time zone.** Everything is the browser's; the page says so.

## 5. Questions for the owner

1. **Merge** `sync/phase-26-scheduling-views` into `develop` and push? (It does not conflict with CR-37 or the CI job; I will run the CI steps on the merged tree before pushing.)
2. **The `deliveries` migration-count test** (my Phase 8 migration, red in CI since): add the one-line allowance, as `audit` has? Test-only, but under `backend/`, so I am asking.
3. **Next.** Left on the deferred list: applying the chosen theme and locale (settings that change nothing today), the delivery milestone picker, cancelling a leave (needs a backend change), the checksum screen. And, if you want the scheduling views to write: drag to move or resize a booking and click a slot to book (a separate decision: it needs overlap handling by the server's `409 booking_overlap`, and an undo story).
