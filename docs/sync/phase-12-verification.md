# Phase 12 — Dashboards & analytics: verification

Branch `sync/phase-12-dashboards` (from `develop` after the Phase 11 merge, `059a4f87`), **not pushed, not merged**. No backend file changed. Two backend requests are proposed and **unapplied**: **CR-30** (the dashboard's milestones are invented) and **CR-31** (overdue and delivery counts break the server's own rules). Both have frontend workarounds in use. The earlier open requests CR-26 to CR-29 (Phase 11) are still waiting for a decision.

## 1. Exit criteria

Plan: *home dashboard and project dashboard on `/projects/{id}/dashboard/`, `/statistics/`, project-scoped `summary/`; `/analytics/{kpis,departments}`; remove remaining client-side metric fabrication.*

| Criterion | Result | Evidence |
|---|---|---|
| Project dashboard on the real payload | ✅ live + unit | every section and every item type is pinned to the captured payload by compiled key lists; the payload and an empty project's pass the screen's schema; `dashboards.live` › the dashboard's counts equal the statistics route's (shots, tasks, reviews, assets, deliveries) |
| `/statistics/` and the project `summary/` | ✅ unit | the twelve counts match the type and the dashboard; the summary holds the same counts |
| `/analytics/kpis` and `/departments` | ✅ live + unit | typed API, pinned; the home dashboard with no project chosen shows the **studio overview** (shots by state, approval rate, artists with tasks, tasks approved per department), and `dashboards.live` checks the tiles against the routes |
| Client-side fabrication removed | ✅ | the invented **Health Index** is gone (the tile now shows the server's weighted overall progress and its method); the payload's five invented milestones are not shown (§5); the overdue and delivery rules are applied here where the server's break (§5) |
| Who may read | ✅ unit | a member, a supervisor and an administrator read; someone in no project gets 404; a user with no role 403; analytics answers every signed-in user with figures narrowed to their projects |

Live files, each on a fresh seed: `dashboards` 2 is new; no other live file touches the changed code.

## 2. Quality gates

| Gate | Phase 11 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 97 files / 931 | **99 files / 964** |
| Live tests | 14 files / 80 | **15 files / 82** |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 2085 warnings | **2 errors (the same two) / 2105 warnings** (style warnings in the new tests, as in the other test files; 0 errors in the files changed) |
| Net size (frontend, against `develop`) | | 18 files, +758 / −104 |

Mutation checks (break the code, expect a failure): the finished-task statuses, a cancelled delivery being counted, the cut-list fallback, the upcoming-delivery rule, the in-progress and overdue milestone states, the schedule permission gate, the watchlist using the raw flag, the KPI card using the server's counts, the approval tile, and an invented payload key. One was not caught at first (the schedule gate: the test asserted before a request could be made) and was fixed by waiting.

## 3. What was built

- **Typed analytics API** (`src/api/analytics/`): `ProductionKpis` (with `null` for what has no source) and `DepartmentAnalytics`, key lists compiled, pinned to the captured responses.
- **Dashboard payload contract** (`features/dashboard/types/dashboardRowKeys.ts`, `__tests__/dashboardContract.test.ts`): 17 types, each with the keys that may be absent; the stale `organization_id` was removed from the project type.
- **Studio overview** on the home dashboard (no project chosen): KPI tiles and tasks approved per department; no render-farm or storage figure is drawn (the server has no source: nulls and zeros).
- **Metrics module** (`utils/dashboardMetrics.ts`): `getTaskFigures` (rates and counts, no composite score), `taskIsOverdue`, `getDeliveryFigures`, `upcomingDeliveryItems`, `milestoneState`.
- **Schedule widget** lists the project's real milestones from Scheduling (overdue when Pending past its date), says so when the viewer cannot see the schedule, and offers "Add one" when there are none.

## 4. Removed (no silent deletions)

- The **Health Index** tile and `getHealthMetrics` (a 50/50 blend of two completion rates minus penalties of 4 per overdue and 5 per blocked task, shown as a percentage with a sparkle): an invented score nothing in the backend defines. Replaced by the server's `production.overall_progress_pct`.
- `projectsApi.dashboard` and the index-signature `ProjectDashboard` type (no caller).

Left alone: the `Velocity Trend` tab, which already says plainly that no history exists.

## 5. Findings (details in `backend-change-requests.md`, "Phase 12 findings")

1. **CR-30 (proposed)** — `schedule.milestones` in the dashboard payload are five fixed phase names ("Plate Turnover & Ingest", …) at 0, 25, 50, 80 and 100 % of the project's span, with statuses from the overall progress; the project's real milestones never appear, and an empty project gets the five, the first "completed" on its first day. The widget reads Scheduling instead.
2. **CR-31 (proposed)** — `recent_tasks[].is_overdue` flags Approved tasks past their date while `tasks.overdue` does not; a Cancelled delivery past its date counts as late; "completed" is not among the delivered words; everything else is "upcoming". The screens apply the rules themselves, and fall back to the server's numbers only when the delivery list is cut.
3. **Behaviours worth knowing:** `shots_at_risk` is the number of **On Hold** shots; `tasks.critical` is overdue **or blocked** (not priority Critical); `is_delayed` is a rule (a late delivery or more than two overdue tasks); overall progress is 60 % approved shots plus 40 % completed tasks and says so; a project without dates gets today and +180 days; a person with no display name is listed by e-mail.
4. **Analytics read more than a person might expect:** any signed-in user may call them; they are narrowed to the caller's projects, so a user in none sees zeros, but a platform administrator sees every project.
5. **My own slips this phase:** the first capture had no cancelled delivery, so the delivery rule was only discovered by a second look; my first overdue test counted the raw flag and passed for the wrong reason until I compared it with the count; and one permission test asserted before the request it forbids could happen.

## 6. Deferred / not done

- **Dashboard history** (burn-up, velocity): the API has no completed-task timestamps.
- **Render farm and storage**: no source.
- **Per-project dashboards for external (client) members**: the route answers 404 for them; not exercised live.
- **A dashboard page per department or per person** (the workload rows have no links).
- The Phase 6 to 11 deferrals stand.

## 7. Questions for the owner

1. **CR-30 and CR-31:** approve? Both are small backend fixes (build the dashboard's milestones from the Scheduling provider; one overdue rule and cancelled/completed deliveries handled), and the screens work without them.
2. Still open from Phase 11: **CR-26, CR-27, CR-29** (small settings fixes), **CR-28** (tags have no permission model), **Q-21** (which flag boolean means "on"), **Q-22** (should one theme and one localization be active).
