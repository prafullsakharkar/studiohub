# Phase 15: the person workspace: verification

Branch `sync/phase-15-person-workspace` (from `develop` at `111a367b`, which holds the merged Phase 14 and CR-32), **not pushed, not merged**. No backend file was touched.

## 1. What was wrong

The person detail page (the sixth legacy workspace; Phase 14 §5) read and wrote fields the API does not have: `avatar_url`, `active_tasks`, `logged_hours`, `assigned_projects`, `department_id/_name`, `team_id/_name`, capitalised statuses (`Active`, `Suspended`) where the API sends `active|draft|inactive|archived`, and a default clearance of "MPAA Tier 3" shown for everyone. Its Assignments tab matched tasks by a substring of the assignee's name, and its Availability tab offered four fixed labels the API does not know (the field is free text).

## 2. What it is now

| Tab | Source |
|---|---|
| Overview | `GET /people/{id}/`: status, position, seniority, department, team, office (by name, linked), timezone, availability, skills; email, phone, clearance, date of birth and nationality **only when the API sends them** (it omits them without `masterdata.person.view_sensitive`) |
| Teams, Departments | every team or department, the current one marked; a choice saves `person.team` / `person.department` (one each; CR-32 for several) |
| Skills | `person.skills`, saved as the whole list with a PATCH |
| Assignments | `GET /tasks/?assignee_id=<person.user>`: tasks are assigned to a login, so a person with no login says so and sends no request; the API narrows to projects the viewer may see |
| Account | the existing identity `AccountSection` |
| History | `EntityHistory` (`Person`) |

Header actions: Edit, and the one lifecycle step the status allows (`deactivate` / `reactivate` / `restore`, the same routes as the roster).

## 3. Removed (no silent deletions)

| What | Why |
|---|---|
| Projects tab | `assigned_projects` is not a field; a person's projects come from a user's project memberships, which no person route returns |
| Availability tab | a fixed list for a free-text field; the value is in Overview and the Edit form |
| Avatar, Active Tasks, Logged Hours, default clearance | no such fields; invented figures |
| `PersonOverviewTab`, `PersonProjectsTab`, `PersonAvailabilityTab`, `PersonActivityTab`, `usePeopleData`, `personApi`, `shared/hooks/useBulkDelete`, `types/masterData.ts` | no importer left (`AccountSection` now uses `peopleApi.keys`) |

## 4. Gates

| Gate | develop | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 96 files / 978 | **97 files / 983** (+5 in `personWorkspace.test.tsx`) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 1360 warnings | **1 error / 1297 warnings** (the removed `useBulkDelete` held one of the two known `useHookAtTopLevel` errors) |
| Live vitest, fresh seed | n/a | `personWorkspace.live.test.tsx`: **1 of 1** (add a skill, choose a team, deactivate, reactivate; each read back from the API) |
| Playwright role smoke (6 roles + phone width) | n/a | **7 of 7 pass** (24.2 minutes) |
| Frontend diff vs develop | | 14 files, +242 / −1,197 |

Mutation checks, 6 of 6 caught: skills not saved, wrong assignee filter, tasks requested for a person with no login, lifecycle doing nothing, email and phone shown when the API omits them.

## 5. Not done

- The assignments tab was verified against captured responses and by reading the backend filter (`assignee_id` filters `Task.assignee`, a user); the live test does not link a login to a person.
- A person's **projects** have no tab (see §3). If wanted, a project-members route filtered by user would be a backend request.
- Several teams per person: CR-32, waiting for approval. The Teams tab will move to memberships if it is approved.

## 6. Questions for the owner

1. **Merge** `sync/phase-15-person-workspace` into `develop`?
2. **Approve CR-32** (a `TeamMembership` table so a person can be in several teams)? Its three open design questions are in `backend-change-requests.md`.
