# Phase 14: the five directory workspaces: verification

Branch `sync/phase-14-workspaces` (from `develop` at `49387e7e`), **not pushed, not merged**. No backend file was touched.

## 1. Why

The Phase 13 cleanup report (`legacy-cleanup-verification.md` §3) found that the client, vendor, department, office and team detail pages read and sent fields the API does not have, so they showed blanks and reported success for writes the server dropped. This phase rebuilds them over the typed API.

## 2. What was built

| Page | Tabs | Source of each tab |
|---|---|---|
| Client | Overview, Projects (needs `project.view`), Contacts, Contracts, History | `clientsApi`; projects searched by the client name and kept only where `client_name` equals it (the projects API has no client filter, so the tab says "matched by name"); the Phase 3 `RelatedRecords`; `EntityHistory` |
| Vendor | Overview, Contacts, Contracts, History | `vendorsApi`; bandwidth link goes through `safeWebUrl` |
| Department | Overview, Teams, People, History | `departmentsApi`; `GET /teams/?department=`; `GET /people/?department=` |
| Office | Overview (incl. the computed `headcount`), People, History | `officesApi`; `GET /people/?office=` |
| Team | Overview, Members, History | `teamsApi`; `GET /people/?team=` |

Shared pieces in `src/modules/directory/workspace/`: `WorkspaceShell` (loading, error, header, tabs), `DetailGrid`, `RecordActions` (edit, archive/restore by `status`, delete with the server's refusal shown), `PeopleTab`, `TeamsOfDepartment`, `ProjectsOfClient`, `PersonLabel`.

Also fixed: the department edit page (now the create form, filled; saves `PATCH` of `name, code, department_type, description, parent, manager, color, software_stack`) and the person page's Teams and Departments tabs, which sent `team_id/team_name/department_id/department_name` (dropped by the serializer, so the choice never saved); they now save `person.team` / `person.department`.

**Membership** lives on the person (`Person.team`, one team each). Adding a member is `PATCH /people/{id}/ {team: <id>}`, removing is `{team: null}`; the team has no member list. A person in another team is moved, and the dialog says so. Multi-team membership would need a new table (backend change, needs approval).

## 3. Removed (no silent deletions), commit `649883cd`

| What | Why |
|---|---|
| 22 tab components: `Dept{Activity,Capacity,Overview,People,Projects,Tasks,Teams,Utilization}Tab`, `Office{Activity,Capacity,Overview,People,Projects,Resources,Schedule}Tab`, `Team{Activity,Assignments,Capacity,Members,Overview,Projects,Utilization}Tab` | built on `head_name`, `member_count`, `capacity_hours_weekly`, `utilization_percentage`, `assigned_projects`, `lead_name` and similar fields the API does not have |
| Tabs with no data source at all: Projects, Tasks, Capacity, Utilization, Schedule, Resources, Assignments (departments, offices, teams) | the API has no department/office/team to project, task or capacity relation; they showed invented numbers. Not re-created |
| Client/vendor "Trash" (`PATCH {status:'Deleted', is_deleted:true}`) | `is_deleted` is not writable; the record stayed listed. Replaced by a real `DELETE` |
| Six hooks (`useClientsData`, `useClientRegistryData`, `useVendorsData`, `useDepartmentsData`, `useOfficesData`, `useTeamsData`) and `api/masterDataApi.ts` | no importer left |
| `ClientSelect`, `ClientContactSelect`, `VendorSelect`, `modules/production/api/productionApi.ts` | no importer (the typed pickers replaced the selects in Phase 3) |

## 4. Gates

| Gate | develop | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 95 files / 971 | **96 files / 978** (+7 in `workspacePages.test.tsx`) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 1505 warnings | **2 errors (the same two) / 1360 warnings** |
| Live vitest, fresh seed | n/a | `workspaces.live.test.tsx`: **3 of 3 pass** |
| Frontend diff vs develop | | 58 files, +1,093 / −4,056 |

Mutation checks (break the code, expect a test to fail): 11 of 11 caught: delete without `DELETE`, archive with the wrong status, projects not narrowed to the exact name, projects not searched by name, remove not clearing `team`, add sending `team_id`, members not filtered by team, current team not marked, choosing a team assigning nothing, department edit creating instead of updating, department edit sending a field the API lacks.

Live (real backend): archive, restore and delete a client (the deleted client answers 404); add and remove a team member, read back through `team`, `team_name` and `?team=`; the office headcount; a department rename.

## 5. Not done, and open questions

- **The Playwright role smoke was not re-run** (about 22 minutes). Routes did not change, but the detail pages now render different content; run it before merging if you want the full check.
- **Person workspace** is a sixth page with the same disease: Projects, Assignments, Skills, Availability and Activity tabs and the header read legacy fields (`assigned_projects`, `avatar_url`, `active_tasks`, …). I fixed only its Teams/Departments tabs. Rebuilding it is the natural next phase.
- The lead and manager are shown by fetching the person by id (one request each, cached 60 s); the API returns only the id.
- Vendors have no Projects tab: nothing relates a project to a vendor.

## 6. Questions for the owner

1. **Merge** `sync/phase-14-workspaces` into `develop`?
2. **Rebuild the Person workspace** as the next phase?
3. Is one team per person enough for the studio, or do you need several (needs a backend change request)?
