# Dashboard for members limited to part of a project: verification

Branch `sync/dashboard-partial-members`, off `develop` at `da5f292d`. Frontend only, so no backend change and no change request. Asked by the owner (2026-11-12) after signing in as a lead and seeing `[ReactQuery] Query Error [["dashboard", "4eb9ca03-…"]] (404 - NOT_FOUND): Project not found`.

## Cause

The dashboard sums up the whole project. Since TM-002 part 2 (`849ef31c`, 2026-10-28, released in v4.1.0), the backend admits only whole-project members to it (`ProductionBaseSelector.user_has_full_project_access`): a superuser, a global admin role, or an active internal membership bound to no show and naming no department. A member limited to a department, a show or a vendor or client side gets **404 "Project not found."**, while a non-member gets "Not found.". The frontend still asked for the dashboard, logged the error, polled it every 60 seconds and showed "Failed to Load Project Dashboard".

Captured on the pytest test database (`tools/test_capture_partial_dashboard.py`, `samples/production/_partial_dashboard_flow.json`), each user a lead artist:

| Membership of project `PDB` | `/auth/me` membership | `GET projects/{PDB}/dashboard/` |
|---|---|---|
| whole project | `show_id: null`, `department: ""` | 200 |
| one department | `department: "Compositing"` | 404 `Project not found.` |
| one show | `show_id: "<show>"` | 404 `Project not found.` |
| vendor side | `vendor_id: "vendor-a"` | 404 `Project not found.` |

The same rule covers the other whole-project nested routes: summary, members, notes, schedule, activity, files, deliveries, editorial, resources and pipeline. Those were not changed here.

## What changed

| Where | What |
|---|---|
| `core/permissions/access.ts` | `partialMembershipOf(user, projectId)` returns `'show'`, `'department'`, `'external'` or `null`, read from the active membership `/auth/me` returns. It is `null` for a superuser, for a whole-project membership, and when there is no active membership: the server then decides, since a platform administrator reaches every project without a membership. |
| `types/identity.ts` | `ProjectMembership.department` and `department_id`, as `/auth/me` sends them. |
| `features/dashboard/hooks/useProjectDashboard.ts` | No request when the membership is partial. |
| `features/dashboard/pages/ProjectDashboardPage.tsx`, `components/DashboardPartialAccess.tsx` | Instead of the error screen, a partial member sees "The project dashboard covers the whole project", a sentence saying what their membership is limited to, and links to Shots, Tasks and Versions and back to the projects. |

Known limit: a non-superuser holding the platform-admin role and also a limited membership of the project would see the message, although the server would answer. The frontend cannot tell that role apart, because role names are display labels and never used for authorization.

## Tests

`features/dashboard/__tests__/partialAccess.test.tsx` (9), served from the capture:
- The captures match the rule.
- `partialMembershipOf` reads each limit, and returns `null` for a superuser, another project, no user, or an inactive membership.
- The page tells a department-, show- or vendor-limited lead that the dashboard covers the whole project, makes no dashboard request, and shows no error.
- A whole-project lead gets the dashboard.

Mutation checks, **6 of 6 killed**: the hook still requesting; the page not showing the message; vendor, show and department each not treated as partial; a superuser treated as limited.

## Results

Gates from `frontend/`:
- `pnpm typecheck`; `pnpm test` **1599 passed** (151 files); `pnpm build`.
- `biome check src --diagnostic-level=error` is clean.
- `unreachable.mjs`: only tests, `*RowKeys.ts` and the existing helpers; the new component is reached.

The role smoke was not run: its seeded lead is a whole-project member, so nothing changes for it.
