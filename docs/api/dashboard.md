# Dashboard API

Phase 6 (2026-09-17): real project-command-center backend for the frontend
`ProjectDashboardData` contract. No frontend API changes were required — the
endpoints below reproduce the existing mock paths exactly.

## Endpoints

| Method | Path | Purpose | Permission |
| ------ | ---- | ------- | ---------- |
| GET | `/api/v1/projects/{id}/dashboard/` | Primary dashboard payload (`getDashboardData`) | `project.view` |
| GET | `/api/organizations/{org}/projects/{project}/dashboard` (+ `/` variant) | Nested fallback (frontend calls on primary failure) | org/project membership (staff bypass) |
| GET | `/api/v1/analytics/kpis/` | Legacy `ProductionKpis` contract (`DashboardService.getKpis`) | authenticated + org scope |
| GET | `/api/v1/analytics/departments/` | Legacy `DepartmentProgress[]` contract | authenticated + org scope |

`{id}` accepts UUID or project code (case-insensitive, same as all
production detail endpoints). The nested `{org}`/`{project}` accept
id/code/slug. Unknown values 404 with `{detail}`; non-members get 403 on the
nested route.

Authentication: JWT (`Authorization: Bearer …`) + `X-Organization-Id` header,
resolved server-side via `resolve_organization_context`. The header is never
trusted for authorization by itself — selectors scope to the resolved org and
`HasPermission` enforces `project.view`.

## Response: `ProjectDashboardData`

Single aggregated JSON object (no pagination — one project per call).
Selector: `apps/production/selectors/dashboard.py::ProjectDashboardSelector.build`.
Aggregation rules mirror
`studiohub-react/src/features/dashboard/api/buildProjectDashboardMock.ts`
(same buckets, same 60/40 methodology) over real records:

```text
overall_progress_pct = round(shots_completion_pct * 0.6 + tasks_completion_pct * 0.4)
(shots-only or tasks-only projects fall back to the available side)
```

Sections and backend sources:

| Section | Source |
| ------- | ------ |
| `project` | `production.Project` (+ supervisor/coordinator display names, client name) |
| `summary` | counts from Shot/Task/Asset/Review/DeliveryPackage |
| `production` | shot buckets; `methodology_note` is a fixed methodology string |
| `shots` | `by_status` (7 canonical keys seeded at 0, unknown statuses pass through), 8 most-recent shots |
| `tasks` | open/in_progress/blocked/review/completed/overdue buckets (case-insensitive mapping), 8 most-recent tasks |
| `reviews` | pending/approved/changes_requested/rejected; `type` is derived as `"<entity_type> Review"` (the model has no screening-type column); `reviewers_count` = length of `reviewers` JSON |
| `schedule` | project dates (same defaulting rule as the project-scoped schedule view: missing dates fall back to today/+180d); 5 milestones interpolated from real dates with statuses derived from real progress; `next_deadline` = nearest upcoming task due date, else nearest delivery expiry, else omitted |
| `workload` | tasks grouped by assignee (unassigned bucketed as `Unassigned`); `overloaded` ≥5 assigned or ≥2 overdue, `high` ≥3 assigned |
| `deliveries` | `DeliveryPackage`; `due_date` = `expires_at` date (`""` when unscheduled); delivered = delivered/approved/sent/accepted/complete |
| `activity` | latest 8 `audit.ChangeLog` rows attributed to the project by `(target_type, target_id)` match (bounded scan, `ACTIVITY_SCAN_LIMIT = 500`); falls back to recently-touched shots/tasks when nothing is recorded yet |

Overdue = `due_date` past and status not completed/approved/done.

### Honest unknowns (never fabricated)

* `render_nodes_busy/total`, `average_render_time_mins` (KPIs): `null` — no
  render-farm source exists.
* `active_artists` (KPIs): distinct task assignees in the org (0 when unassigned).
* `next_deadline`: omitted when nothing is scheduled.
* Delivery `due_date`: `""` when `expires_at` is unset.
* Review `scheduled_date`: omitted (no such column).

## Status codes

`200` payload · `401` unauthenticated · `403` nested non-member ·
`404` unknown project/org · standard `400`/`500` envelope from Core.

## Organization isolation

Primary: org-scoped queryset + `project.view` object permission — a project in
another org 404s. Nested: URL org + project must match, plus membership gate.
Covered by `test_cross_organization_isolation`,
`test_nested_cross_org_project_404`, `test_nested_non_member_forbidden`.

## Seed data

`uv run python manage.py seed_production_mocks` imports the frontend mock
dataset as real records (idempotent; `--reset` to clear first), which is what
local rest-mode verification uses.

## Tests

`backend/apps/production/tests/test_dashboard.py` (13 tests): full shape +
real values, code lookup, 404s, org scoping, empty project, project switching,
workload buckets, nested parity, KPIs shape (incl. archived exclusion).
Payload also validated against the frontend zod schema
(`ProjectDashboardDataSchema.safeParse` → clean).

## Frontend wiring

None required — `getDashboardData` already calls the primary endpoint with the
`X-Organization-Id` header and falls back to the nested route. Switch modes
via `VITE_API_MODE=mock|rest` (`localStorage` override `vfx_api_mode_override`).

Known rest-mode follow-up (frontend, out of scope here): the production store
defaults `activeProjectId` to the mock id `proj-001`, so a cold boot fires one
404 round (error toast) before the app resolves a real project. The e2e visual
spec works around this with API bootstrap + a steady-state gate.

## Metric provenance (UI → query → endpoint → filter → records)

Every dashboard number traces to project-scoped records; the single source is
`GET …/dashboard/` (TanStack key `['dashboard', organizationId, projectId]`,
placeholder data never crosses projects, error state on failure — no mock
fallback). Widget derivations live in
`studiohub-react/src/features/dashboard/utils/dashboardMetrics.ts`.

| UI metric | Frontend derivation | Endpoint field | DB aggregation |
| --------- | ------------------- | -------------- | -------------- |
| KPI cards (shots/tasks/assets/reviews/deliveries) | direct render | `summary.*` | exact `COUNT`s per entity |
| Task pie + status list | `getTaskStatusDistribution` (sums to `total`) | `tasks.*` | `GROUP BY status` buckets |
| Domain comparison bars | `getCategoryComparison` (`?? 0`, Risk incl. rejected reviews) | `summary.*` + `tasks.*` | grouped counts |
| Health Index | `getHealthMetrics` (50/50 blend − penalties, 0 on empty scope) | `summary.*` + `tasks.*` | same counts |
| Velocity tab | honest empty state — completed-task timestamps are not collected | n/a (documented gap) | n/a |
| Progress bar + methodology | direct render of `overall_progress_pct` | `production.*` | 60/40 rule in selector |
| Shot matrix | direct render of `by_status` + `recent_shots` | `shots.*` | grouped counts + 8-row slice |
| Schedule/milestones | direct render; `TBD` when undated | `schedule.*` | project dates + progress |
| Workload roster | direct render (top 5 of full list) | `workload.team_members` | per-assignee grouped annotation |
| Watchlist header | `tasks.critical` (exact overdue∪blocked) | `tasks.critical` | union count |
| Activity stream | direct render, safe timestamps | `activity[]` | ChangeLog attribution + entity fallback |

Accuracy hardening (Phase 6b): backend counts moved from capped in-memory
slices (`[:5000]`) to database-side aggregation so totals stay exact at any
project scale; `tasks.critical` and `summary.rejected_reviews` added for exact
widget headers; frontend sample literals (`45/18/24/…`, `Wk 1…Wk 5`, `96.2%`)
and the fabricated velocity series removed; persisted real project selections
survive reload (`resetActiveProjectForOrg` trusts non-mock ids).

## Tests

* Backend: `apps/production/tests/test_dashboard.py` (15 tests incl.
  bucket↔total reconciliation and critical-union correctness).
* Frontend unit: `features/dashboard/utils/__tests__/dashboardMetrics.test.ts`
  (11 tests: partitions, reconciliation, zero-scope, NaN safety).
* E2E: `e2e/dashboard-accuracy.spec.ts` (5 tests: UI==API equality,
  A→B→A switching via the real switcher, refresh survival, empty project,
  API-failure error state).
