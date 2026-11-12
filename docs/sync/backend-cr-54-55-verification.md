# CR-54 and CR-55: verification (backend)

Branch `sync/cr-53-partner-reads`, on top of CR-53 (`f5d6c7e5`, `fe7bba27`). Change requests: `docs/sync/backend-change-requests.md` CR-54 and CR-55, approved by the owner ("approve CR-54 and CR-55", 2026-11-12). CR-55 was approved as written: the vfx-supervisor reads and writes a project without its budget.

Contracts and decisions:
- production C-68 and C-69, plus the nested-route table row (`docs/production/CONTRACTS.md`);
- the D-07 note "CR-54 and CR-55" (`docs/production/DECISIONS.md`);
- the pre-deploy checklist entry: run `init_platform` after deploying.

## What changed

| Where | What |
|---|---|
| `production/constants/permissions.py` | `ProjectPermissions.VIEW_BUDGET = "project.view_budget"`. |
| `core/management/commands/init_platform.py` | The code is in `PERMISSION_SPECS` (`projects`, `view_budget`) as `PROJECT_VIEW_BUDGET`. Production-admin and org-admin hold it; platform-admin has the whole catalog. It is **not** in `PRODUCTION_FULL_PERMISSIONS`, so the vfx-supervisor, who shares that set, does not hold it. No withdrawal is needed: no role held the code before. |
| `production/selectors/project.py` | `summary_counts(project, *, include_deliveries)` is required. Without it, `deliveries` is counted from `NO_DELIVERIES` (0). |
| `production/selectors/dashboard.py` | `build(project, *, include_deliveries, include_budget)`. `_project_metadata` leaves `budget_usd` out without `include_budget`. |
| `production/api/serializers/project/base.py` | `can_view_budget` (asked once per response; the answer is kept in the serializer context, so a page of projects checks it once) and `BudgetGatedMixin`, which pops `budget_usd`. `ProjectSerializer` (list, detail, the summary's `project`) uses it. |
| `production/api/serializers/project/{create,update}.py` | The write serializers use the mixin too, because the answer to a create or update is rendered by them. This was not in the CR text: it was found while building the change. Without it, a supervisor's `PATCH {"name": …}` would have returned the budget. |
| `production/api/viewsets/project.py` | `_guard_budget`: a create (`perform_create`) or an update (`check_update`) whose data names `budget_usd` without the code raises 403 before anything is saved. The value does not matter, so the answer says nothing about the stored budget. `statistics` and `dashboard` pass the two keywords. |
| `production/api/views/project_scoped.py` | `summary` passes `include_deliveries`; the fallback dashboard passes both keywords. |

**OpenAPI schema: unchanged.** `manage.py spectacular` output is identical to the committed `frontend/src/core/api/generated/schema/django-openapi.yml`. The mixin's explanation is a comment rather than a docstring, because a docstring would have become the description of five project schemas. `budget_usd` was already optional in the schema (the model has a default), so the generated types need no change.

## Evidence after the change

Same capture as the CRs (`tools/test_capture_budget_counts_cr54_55.py`, pytest test database, rolled back). Project `BDG` has `budget_usd` 4,800,000 and two deliveries. "—" means the key is absent.

| Request | artist | lead-artist | vfx-supervisor | production-admin |
|---|---|---|---|---|
| `projects/` row, `projects/{BDG}/`, `summary/` `project` → `budget_usd` | — | — | — | 4800000.00 |
| both dashboards → `project.budget_usd` | — | — | — | 4800000.0 |
| `statistics/` `deliveries`, `summary/` `counts.deliveries` | **0** | 2 | 2 | 2 |
| `dashboard/` `deliveries.total` (CR-53) | 0 | 2 | 2 | 2 |

The vfx-supervisor's writes:
- `PATCH projects/{BDG}/ {"budget_usd": "1.00"}` → **403**, with the body `{"detail": "Setting budget_usd requires project.view_budget.", "error": {"code": "permission_denied", "request_id": …}}`.
- `PATCH {"name": "BDG renamed"}` → **200**, and the answer has no `budget_usd`.

The committed sample `samples/production/_budget_counts_cr54_55.json` keeps the responses from *before* the change, as the CRs' evidence. The capture after the change is `samples/production/_budget_counts_cr54_55_after.json` (`SYNC_SAMPLE_NAME`), which the frontend tests serve. The supervisor's two PATCH entries were added to the tool with the change.

## Tests

**New: `production/tests/test_cr54_55_budget_counts.py` (19)**, against the real seeded roles.

CR-54:
- On both `statistics` and `summary`, an artist counts 0 deliveries and a lead counts 2.
- Every other count is the same for both.

CR-55 reads:
- Vfx-supervisor, lead and artist get no `budget_usd` on the list, the detail, the summary or either dashboard.
- Producer and org-admin get it on all five.
- A superuser gets it.
- Apart from the budget, the project record is the same with or without the code.

CR-55 writes:
- A supervisor's PATCH naming the budget is 403 and saves nothing, the name included. Naming the stored value is also 403.
- A supervisor's PATCH without it is 200, and the answer has no budget.
- A supervisor's create with a budget is 403 and creates nothing. A create without one is 201, and the answer has no budget.
- The producer sets the budget on update and on create, and the answers show it.

**Updated to the new rule:**
- `production/tests/test_permission_matrix.py`: production-admin and org-admin hold `project.view_budget`. The code is listed as checked inline, like `timelog.manage`.
- `deliveries/tests/test_provider.py`: passes the new keywords.

Unchanged and still passing: `security/test_external_segregation.py` (external members never see the budget; the studio member there holds every code) and `test_cr53_dashboard_deliveries.py`.

## Results

- **Targeted run** (no full suite, per the project rule): `apps/core`, `apps/production`, `apps/deliveries`, `apps/masterdata`, and the permission-matrix and calendar-scope tests of publishing and scheduling. **3897 passed**, none failed.
  - After the last two edits (a docstring became a comment; type annotations), the 75 tests of the new, matrix, external, CR-53 dashboard and provider files were run again and pass.
- **Mutation checks (15 of 15 killed),** run again after the last edit. For each mutant the named tests fail, and the file was restored afterwards:
  - the count ignoring `include_deliveries`;
  - `statistics` or `summary` always counting deliveries;
  - the read gate removed;
  - the create or the update answer not gated;
  - the dashboard ignoring `include_budget`;
  - either dashboard route always including the budget;
  - the write guard a no-op;
  - update or create skipping the guard;
  - the supervisor holding the code;
  - org-admin or production-admin lacking it.
- **Static checks:**
  - `ruff check .` is clean, and `manage.py check` gives only the two existing key warnings (`MFA_ENCRYPTION_KEY`, `API_KEY_PEPPER` unset in the testing environment).
  - `ruff format --check`: no new violations. The four changed files that would be reformatted (`init_platform.py`, `project_scoped.py`, `dashboard.py`, `selectors/project.py`) were already unformatted at HEAD, on lines this change does not touch.
  - `basedpyright` on the changed source files: no errors in the serializers or `selectors/project.py`. The bare `dict` on the changed `summary_counts` line was typed `dict[str, int]`. The eight pre-existing bare-annotation errors in `dashboard.py` are not on changed lines.

## Deploy

Run `manage.py init_platform` right after deploying the backend. Until it runs, `project.view_budget` is in no role, so only superusers read or write budgets. A custom role that tracks budgets needs the code added by hand.

## Frontend step (second commit)

| Where | What |
|---|---|
| `core/permissions/permissionMap.ts` | `field.project.budget.view` and `field.project.budget.edit` are `codes('project.view_budget')`. They were `open` and `project.update`. |
| `core/permissions/backendCodes.ts`, `samples/_misc/permissions.json` | The new code is added. The sample's grants follow `init_platform` for this change only: platform-admin, org-admin, production-admin. |
| `modules/production/structure/configs.tsx` | The project form's "Budget (USD)" field has `permission: 'project.view_budget'`. A field hidden that way is not rendered, validated or sent (`DirectoryFormPage`). |
| `api/production/structure.ts` | `Project.budget_usd` is optional. |
| `modules/production/structure/panels.tsx` | The overview panel leaves the `deliveries` count out without `delivery.view`, because the server's 0 is not a count (CR-54, the optional part). |
| `e2e/live/roles.smoke.spec.ts` | New check: in the new-project form the producer gets the budget input and the supervisor does not, with no refused or failed request. |

Tests are served from responses captured after the change (`samples/production/_budget_counts_cr54_55_after.json`, same tool):
- `structure.test.tsx`:
  - The captures match the rule.
  - An editor without the code edits a project with no budget input. The PATCH body is exactly the changed name.
  - An editor without the code creates a project with no budget input, and the POST has no `budget_usd`.
  - A holder sees the stored budget and saves a change, and the PATCH is exactly `{budget_usd: 5000000}`.
  - The overview hides the artist's 0 deliveries and shows the lead's 2.
- `permissionMap.test.ts`: both budget keys resolve to `project.view_budget`.
- Mutation checks, **4 of 4 killed**: each map entry reverted (two), the form field ungated, the overview filter removed.

Gates from `frontend/`:
- `pnpm typecheck`; `pnpm test` **1591 passed** (150 files); `pnpm build`.
- `biome check src --diagnostic-level=error` is clean.
- `unreachable.mjs`: only tests, `*RowKeys.ts` and the existing helpers.

**Browser role smoke** against the throwaway factory-seeded backend (`tools/run_role_smoke.sh --grep "project budget input"`): **2 passed**. In the new-project form the producer gets the budget input and the supervisor does not, with no refused or failed request. The first run lost the supervisor's page to `net::ERR_NETWORK_CHANGED`: the trace shows 18 aborted requests and a blank page. The check now reloads up to three times, as the route loop does, and the second run passed with no reload. The full route loop was not rerun: no route, guard or request changed, only one form field and one panel entry.
