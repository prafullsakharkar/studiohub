# Legacy cleanup and Q-22: verification

Two branches, both from `develop` after Phase 13 (`87e2246c`), **not pushed, not merged**:

- `sync/q22-default-theme-locale`: Q-22 (one default theme, one default localization). Touches the backend (one migration) and the settings screens.
- `sync/legacy-cleanup`: the legacy cleanup the owner asked for. Frontend only; no backend file touched.

## 1. Q-22

Approved with "Q22: yes", after I wrote that it needs a new field. Details and the contract are in `backend-change-requests.md` ("Applied: Q-22").

| What | Where |
|---|---|
| `is_default` on `Theme` and `Localization`, a partial unique constraint (one default among the live rows), a data step that makes the earliest active existing row of each kind the default | `apps/settings/models`, `migrations/0002_theme_localization_default.py` |
| `POST …/{id}/set-default/` (`settings.manage`), `GET …/default/` (any signed-in user, 404 until one exists), filter `is_default`, `is_default` read-only on every write | `api/viewsets`, `serializers`, `filters`, `services/default_selection.py` |
| The default is always active; it cannot be deactivated (action or `PATCH`) or deleted until another is the default; the first active row made through the API becomes the default | services and serializers |
| Frontend: a Default badge, a Make default action, no Deactivate or Delete on the default; types, API calls and compiled key lists | `api/settings`, `modules/settings/records.tsx` |

`is_active` keeps its meaning ("available"). This replaces CR-29's "the last active theme cannot be deleted" with the default rule.

Evidence: 33 backend tests (`test_q22_default.py`), **20** source and migration changes reverted in turn and caught (the first pass missed three: two tests were too weak and one path had no test, and were fixed); settings, identity security and bootstrap suites 847 pass and 1 fail that is not mine (the deliveries migration-count test, as before); `makemigrations --check` clean; the settings capture re-run (221 calls, no existing call changed status) and the contract, screen and live tests updated (live `settings` 4 pass against the changed backend). The default endpoint is open to any signed-in user, including through a scoped key (`credential_open_actions`): that is a decision I made inside the approval, and it is one line to close.

## 2. Legacy cleanup: what was removed

Each is its own commit, so it can be reverted alone.

| Commit | What | Why it was safe |
|---|---|---|
| `e61bd054` | `BaseRepository`, `IBaseRepository`, `modules/sequences` (repository, service, hooks, barrel), the editorial-track repository, service and hooks; 14 files | used by nothing but each other; sequences and tracks are read and written through `api/production/structure`. The one live reference (`useBulkShots` invalidating sequence queries) now uses `sequencesApi.keys.all`. One test case that exercised the removed `SequenceRepository` went with it |
| `bc887366` | the client-side activity feed: `useActivityStore`, `activityService`, `ActivityTimeline`, the command palette's Recent Activity tab, the workspace panel's activity section, and the 26 places that wrote to it; 17 files, 1,568 lines | the feed was an in-memory list with a hard-coded actor ("Alex Chen"), lost on reload, not the server's history. The record's real history is `EntityHistory`. The workspace panel renders only a not-found state (`resolveEntity` returns `null`), so its activity section was never visible |
| `9be84b21` | the legacy Platform Administration page: `PlatformAdminPage`, seven tab components, the OrgStructure sections, `core/masterData/useMasterData`, two tests; 7,080 lines | the five catalog tabs could never render (the route redirected their slugs to `/platform/catalog` since Phase 3); roles, groups, departments and positions have their own screens. `/platform/admin[/:tab]` and `/platform/master-data[/:tab]` now redirect (`adminTabTarget`, tested) |
| `2ef6b817` | 77 unused `masterDataApi` methods and their type imports; `usePermissionEvaluator`, `core/api/generated/types.ts`, `types/audit.ts`; 707 lines | no importer |

The browser smoke (`docs/sync/tools/run_role_smoke.sh`) was re-run on this branch: **7 of 7 pass** (6 roles and the phone-width pass, 21.5 minutes). Mutation checks: the palette tab, the redirect map (three), the session cleanup carried over from Phase 13.

## 3. Legacy cleanup: what I did not do, and why (read this)

**The five directory workspace pages show and send fields the API does not have.** I rewrote the six legacy hook modules (`useClientsData`, `useVendorsData`, `useDepartmentsData`, `useOfficesData`, `useTeamsData`, `useClientRegistryData`) onto the typed directory API, and the typecheck then reported 44 errors (37 about fields the API schema does not have, 7 about barrel exports I had dropped). I reverted the rewrite, because moving the transport would only have hidden the 37. They are the pages telling the truth. The fields below are missing from the API's schema (the generated types); a write of an unknown key is dropped by the serializer.

| Page | Reads, but the API has no such field | Sends, but the API has no such field |
|---|---|---|
| Client workspace | `is_deleted`, `city`, `country`, `description`, `website` | Trash sends `PATCH {status: 'Deleted', is_deleted: true, deleted_at}`. **Checked against the backend:** it answers 200, sets the status text to "Deleted", and the client **stays in the list** (`is_deleted` is not writable); `DELETE` answers 204 and removes it |
| Vendor workspace | `city`, `country`, `description`, `website` | |
| Department workspace and edit | `head_name`, `head_id`, `head_avatar`, `member_count`, `capacity_hours_weekly`, `utilization_percentage`, `assigned_projects` | `assigned_projects`, `head_name` (silently dropped) |
| Office workspace | `manager_name` | |
| Team workspace, members and projects tabs | `lead_name`, `department_name`, `member_count` | `member_ids`, `lead_id` (the team schema has `lead` and no member list, so the serializer drops them: "adding a member" cannot save; not each of these was run against the backend) |
| Department teams tab, person teams and departments tabs | `department_id`, `department_name`, `lead_name`, `head_name`, `member_count` | |

So these pages show blanks for some fields and report success for writes the server ignores. The list, form and delete screens built in Phase 3 are correct; the workspace (detail) pages and their tabs were not rebuilt. They need a phase of their own: a detail page per entity over the typed API (the Phase 3 `RelatedRecords` and `EntityHistory` pattern), with real fields, and for teams a decision on where membership lives (the backend has no team member list; `people` carry a `team` field, to be confirmed). I stopped here rather than guess.

Also left, smaller: `modules/shots|tasks|assets` bulk managers and `WorkspacePanel`/`SplitView` (the workspace tab feature; it resolves no entity and renders a not-found state), which look like the same story.

## 4. Gates

| Gate | After Phase 13 | `sync/legacy-cleanup` |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 96 files / 959 | **95 files / 966** (net +7: 15 redirect cases and a palette check added; the tests of the removed page, the sequence repository and the feed removed with them) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 1853 warnings | **2 errors (the same two) / 1505 warnings** (the removed files held most of the warnings) |

## 5. Questions for the owner

1. **Rebuild the five workspace pages** (client, vendor, department, office, team, with their tabs) over the typed API, as a phase of its own? The evidence is §3. For teams I need to know where membership is meant to live.
2. **Merge** `sync/q22-default-theme-locale` and `sync/legacy-cleanup` into `develop`? Q-22 changes the backend (one migration, which also chooses a default row in each of the two tables on the real database when it is migrated).
