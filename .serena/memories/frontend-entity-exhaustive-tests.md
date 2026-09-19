# Exhaustive entity tests (2026-09-19, studiohub-react)

## Results
vitest 295/295 (39 files, +64 new), engine runner 135/135 (+8),
tsc/api:validate/build clean.

## New files
- entities/EntityListMatrix.test.tsx (23): list/search/filter/toolbar+row gating x8 entities.
- entities/EntityMutationRoundtrips.test.tsx (11): mock CRUD roundtrips + isolation + 404.
- entities/EntityWorkspaceRelations.test.tsx (7): team members/lead, dept projects,
  person assigns/status, invitation lifecycle, project close/clone/archive, 2 workspace renders.
- entities/EntityFormsSelectors.test.tsx (6): client/vendor required guards, code uppercase, 4 selectors.
- security/EntityRbacIsolation.test.tsx (17): 6-persona matrix, vendor/client fencing,
  multi-org, search-modal filtering, keyboard canNavigate, activity org scope, error map, dialog a11y.
- core/testing/suites/entityExhaustiveSuites.ts wired into TestRunnerEngine.
- docs/frontend/ENTITY_TEST_INVENTORY.md (machine-readable + exclusions).

## Gotchas
- createUser({permissions}) => role 'Artist' + direct perms []; wildcard lives in
  memberships too. PermissionControl hard-denies Artist CRUD by design -> test
  admins must use role 'Organization Admin' (or similar).
- features testUtils mock can/hasPermission now include membership perms.
- One render per test (document-level queries contaminate across renders in a test).
- People POST uses full_name (not name); pills with duplicate labels need tag filter.
- ProjectsPage status filter is server-side -> assert query params, not DOM.
- Universal modal categories = 9 pills (no dept/team/office/org pills).
- Dialog+Modal both role=dialog -> use getAllByRole.
- Keyboard tests must avoid nested Router (plain render + MemoryRouter).
- mockRouter dispatches have ~120ms delay; inMemory state persists across tests
  in a file -> unique names per created record.
- No playwright browsers in this env -> e2e not executable; specs untouched.
