# RP-3 Approval roll-up: verification

Branch `feature/rp-3-approval-rollup`, off `develop` at `94cb2359` (RP-2 merged, not pushed). The plan and contracts are commit `afe094f2` (Q-RP-15 to Q-RP-18 = A). **Backend (WP 3.1, 3.2), frontend (WP 3.3) and docs (WP 3.4) built, uncommitted.** Not pushed, not merged.

## 1. What changed

| WP | Contract | Change | Files (`backend/apps/production/` unless named) |
|---|---|---|---|
| 3.1 | C-RP-14 | `Project.approve_task_on_version_approval` (boolean, default `false`), migration `0007_rp3_project_approval_rollup`. It is in the read, create and update serializers' field lists. The migration-chain test allows `production` seven migrations. | `models/project.py`, `migrations/0007_…`, `api/serializers/project/{base,create,update}.py`, `backend/apps/core/tests/test_bootstrap.py` |
| 3.2 | C-RP-15 | `ApprovalRollupHandler` on `StatusChanged`, registered in `events/__init__.py`, acts only on a `Version` moving to `Approved`. `ApprovalRollupService.roll_up`, in a transaction of its own, does the following: <ul><li>re-reads the version (it must still be `Approved`, live and have a task);</li><li>checks the project's switch;</li><li>locks the live task and leaves `Approved` and `Archived` tasks alone;</li><li>moves the task through `StatusService.transition_status(enforce=False)`, with the approver as the actor and the reason `Version <code> approved`.</li></ul> The handler logs any error (`approval_rollup_failed`, with the version and actor ids) and never raises. | new `services/approval_rollup.py`, new `events/handlers.py`, `events/__init__.py` |
| 3.3 | | <ul><li>The project form has a checkbox, "Approve the task when one of its versions is approved".</li><li>When the switch is on, the project header says "Tasks approved with their versions".</li><li>Duplicate copies the switch.</li><li>On the version page, the status menu and the actions (publish, promote…) also refetch the task queries. Those queries stay fresh for 2 minutes otherwise, so an open task page would show the old status.</li><li>The `Project` type and its row keys gain the key; generated OpenAPI types regenerated.</li></ul> | `frontend/src/api/production/{structure,structureRowKeys}.ts`, `modules/production/structure/configs.tsx`, `modules/production/components/{ProjectWorkspace,CloneProjectDialog}.tsx`, `modules/production/review/VersionWorkspace.tsx`, `core/api/generated/*` |
| 3.3 | | Capture tool and sample. The capture covers: <ul><li>two projects, one with the switch on and one by default;</li><li>the list and the detail, read as the admin so that `budget_usd` is present (CR-55);</li><li>switching off, the 403 for an artist and the 400 for a non-boolean;</li><li>a version approved on each project, then each task and its status history.</li></ul> | `docs/sync/tools/test_capture_production_rollup.py`, `docs/sync/samples/production/_rollup_flow.json` |
| 3.4 | | CONTRACTS ("Details settled while building RP-3"), PLAN status, pre-deploy checklist entry, this report. | `docs/review-pipeline/`, `docs/07-deployment/pre-deploy-checklist.md` |

**Also fixed, from RP-2:** `ProjectNoteLink` was never registered in the Django admin. `apps/core/tests/admin/test_admin_registry.py` requires every concrete model to be registered, and fails without it. My RP-2 runs did not include that test, and neither did the RP-2 merge check. It is now registered read-only, like `StatusHistory`, because only `ProjectNoteService` writes links, after checking them (`admin/project_scoped.py`). The same fix is on `develop` as `d3941147`, pushed together with the RP-2 merge after `develop` passed the backend suites (production, core, deliveries, publishing: 3,247) and the frontend gates (1,628 tests, typecheck, Biome, build).

Removed: the `Project` row of `structureContracts.test.ts`. The project shape is now pinned in `rollupContracts.test.ts` to `_rollup_flow.json`, because `_structure_flow.json` predates the key and its capture tool fails on the CR-49 code prefix.

## 2. Evidence

| Check | Result |
|---|---|
| RP-3 tests (`tests/test_rp3_approval_rollup.py`) | **29 pass.** Covered: <ul><li>the task approved from each working state (Not Started, In Progress, Pending Review, Retake), by `PATCH` and by promote;</li><li>switch off (the default), and one project on not affecting another;</li><li>`Approved`, `Archived` and deleted tasks left alone; a version without a task;</li><li>other version moves (Retake, In Progress) and leaving `Approved` later do nothing (Q-RP-16);</li><li>an older version counts (Q-RP-18);</li><li>the history row (approver, reason, no override kind), one `StatusChanged` for the task, and a second run changing nothing;</li><li>nothing before the commit;</li><li>a forced failure: the approval still answers 200 and `approval_rollup_failed` is logged;</li><li>only a version approval reaches the service, and the service re-reads the version;</li><li>the handler is subscribed;</li><li>C-RP-14: the switch is in the detail and the list, defaults to `false`, is written with `project.update`, refused without it (403), and a non-boolean is a 400; it can be set on create.</li></ul> |
| Backend mutations | **12 of 12 caught**: <ul><li>switch ignored;</li><li>roll-up from Archived;</li><li>version status not re-read;</li><li>deleted task counted;</li><li>fences enforced (`enforce=False` dropped);</li><li>no reason;</li><li>no actor;</li><li>the handler taking any entity;</li><li>the handler taking any status;</li><li>a handler error escaping;</li><li>switch on by default;</li><li>switch not writable.</li></ul> At first the handler's status filter and the service's re-read each covered for the other. One test for each was added before the run. |
| Backend suites, test database | **Every app's tests ran, 7,141 pass**: <ul><li>`apps/production`, `apps/core`, `apps/deliveries` and `apps/publishing`: 3,275 pass, plus 1 failure, the RP-2 admin registration above, which passes once fixed;</li><li>`apps/audit`, `apps/identity`, `apps/masterdata`, `apps/scheduling` and `apps/settings`: 3,866 pass.</li></ul> This is wider than the usual targeted runs, because the RP-2 miss showed the narrower runs can let a failure through. `manage.py test` was not used. |
| `ruff check`, `manage.py check`, `makemigrations --check` | clean (`check` shows only the two key warnings of the testing settings) |
| `ruff format` (changed files) | formatted |
| basedpyright (changed files) | **0 errors** |
| Frontend: `pnpm typecheck`, `biome check src`, `pnpm test`, `pnpm build` | clean, 0 errors, **1,637 pass** (154 files), passes |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the existing helpers |
| New frontend tests | <ul><li>`rollupContracts.test.ts` (5): the project keys, and C-RP-14 and C-RP-15 against the capture.</li><li>Project form (2): an edit sends only the switch; a create sends it, and it starts off.</li><li>Project workspace (2): the header says when the switch is on, and only then; Duplicate copies it.</li><li>Version page (1): approving from the status menu refetches the task queries.</li></ul> |
| Frontend mutations | **6 of 6 caught**: <ul><li>no checkbox;</li><li>clone drops the switch;</li><li>header always on;</li><li>header never on;</li><li>status menu not refetching tasks;</li><li>key not pinned.</li></ul> |
| OpenAPI schema | The only change is the new key on the project schemas. |
| Live run | Not run: the role smoke needs a seeded backend and stays manual. |

## 3. Corrections and choices (also in CONTRACTS.md)

1. **No bulk status change for versions.** The plan listed one, but only `PATCH` and promote approve a version.
2. **No server-side clone.** The frontend's Duplicate copies the switch instead.
3. **Promote on an already approved version rolls nothing up.** That version's roll-up happened at its approval, and the frontend offers "Make hero" only for approved versions.
4. **Not retroactive.** Turning the switch on does not approve tasks of versions approved earlier.
5. **Visible to client and vendor members** who can read the project. It is a workflow setting.
6. **The approver needs no task code.** The project's rule approves the task (Q-RP-5), within the shot or asset the approver can already reach. The task's history names them.
