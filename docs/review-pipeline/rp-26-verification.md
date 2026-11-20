# RP-26 verification: the task on the Versions list

Built 2026-11-20 on `feature/rp-26-version-task`, off `develop` at `680d51c6` (v4.22.0), with every recommendation of Q-RP-117 to Q-RP-120 ([DECISIONS.md](DECISIONS.md#rp-26-answers): 117 to 119 A, 120 B). Committed `8363660c`. Contract C-RP-61 ([CONTRACTS.md](CONTRACTS.md#rp-26-the-task-on-the-versions-list)). No migration, route, permission code, setting or dependency; no ADR (who reads what is unchanged).

Why: RP-24's *To review: Mine* lists the versions waiting on tasks you review, but no row said which task; the task was shown only on a version's own page (RP-21). The list could not be narrowed to a task, and a task's page had no versions.

## What was built

- **The task on a version row** (WP 26.1, Q-RP-117, Q-RP-119): every version answer (`versions/`, `versions/{id}/`, the answers of publish, unpublish and promote, and `/api/organizations/projects/{id}/versions/`) gains `task_code` and `task_title`. They are given only when the caller holds `task.view` and the task list's own scoping (project membership, the external members' narrowing) gives them the task; otherwise `null`, and `task_id` is given either way. `TaskSelector.readable_ids` checks a page's task ids in one query, and the serializer keeps the answers in the shared context (as CR-55's budget check does), so a page costs one task query whatever its size. An archived task counts as unreadable, as the task list hides it.
- **`versions/?task_id=<id>`** (WP 26.2, Q-RP-118): one task's versions, inside what the caller already reads; an unknown or malformed id gives no rows, never a 400 (as `tasks/?reviewer_id=`). No `shot_id` or `asset_id` filter (Q-RP-120 B).
- **Frontend** (WP 26.3):
  - the Versions list's *Task* column (`VersionTaskCell`): the code, linking to `/tasks/{id}`, the title as its tooltip, "—" when null; the export's *Task* column after *For*;
  - a version card names the task first in its subtitle, so the queue reads the same as cards;
  - the task page's *Versions* tab (for holders of `version.view`): its versions through `?task_id=`, newest first, each linking to the version, with artist, status and date (`formatDateTime`);
  - types, row keys, regenerated OpenAPI types.
- **Captures** (WP 26.4): the new `test_capture_version_task_list.py` (`production/_version_task_list_flow.json`) reads the same versions as a supervisor, a vendor member, a client member in a review and a role without `task.view`, the filter with a known, an unknown and a malformed id, with the queue, another project and as the client, and the task page's readers. Thirteen flows that hold version rows were recaptured; compared with the committed samples by key path they only gain `task_code` and `task_title`, except `_review_flow.json` (below).

What the capture shows:

| Reader | Comp v001 | Comp v002 | Light v001 | Plate (no task) | Roto (archived task) |
|---|---|---|---|---|---|
| Supervisor | COMP, Comp | COMP, Comp | LIGHT, Lighting | null | null |
| Vendor member (vendor of Comp) | COMP, Comp | COMP, Comp | not listed | not listed | not listed |
| Client member in a review of Comp v001 | null (task_id given) | not listed | not listed | not listed | not listed |
| Role without `task.view` | null | null | null | null | null |

## Gates

| Gate | Result |
|---|---|
| `ruff check .` | All checks passed; the new test and capture are formatted; the three changed source files were not formatted at HEAD and were edited by hand |
| `manage.py check` / `makemigrations --check` | no issues / No changes detected |
| basedpyright, changed files | 0 errors |
| Targeted backend: `apps/production` and `apps/core/tests/test_bootstrap.py` | 2,299 passed (13 new); after `readable_ids` was typed, RP-24's and RP-26's files again: 22 passed |
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 186 files, 2,080 tests (15 new) / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| Captures | the new one and the thirteen recaptured pass, one at a time |
| Live (`run_role_smoke.sh --vitest`) | `versionTaskList` 2/2: the supervisor's queue names each waiting version's task, linking to it with its title; the comp task's page lists both comp versions and not the lighting one; the API's `?task_id=` answers the same, with the task's code and title |

## Mutation checks

13 mutations, 13 failed the tests; each file was restored and byte-compared.

| Mutation | Failed |
|---|---|
| The fields without the per-task check | 2 |
| The fields without `task.view` | 1 |
| The filter ignored | 4 |
| A malformed id not caught (500) | 2 |
| One task query per row | 1 |
| An archived task shown | 1 |
| Frontend: the column always "—" | 1 |
| Frontend: the link without the title tooltip | 1 |
| Frontend: the export without the task | 1 |
| Frontend: the card without the task | 1 |
| Frontend: the tab shown without `version.view` | 1 |
| Frontend: the tab listing without `task_id` | 1 |
| Frontend: the tab in another order | 1 |

## Found while building

1. **`_review_flow.json` was many phases behind.** It was last captured at RP-1, so besides `task_code` and `task_title` the recapture adds fields from RP-5 to RP-25 (`review_media`, the project's review settings, grades, slates) that the backend already answered; nothing was removed. Its filter probe now shows `task_id` narrowing the list, so `reviewContracts.test.ts` moved `task_id` from "ignored" to "filters".
2. **RP-25's regeneration missed the probe's `slate` and `slate_skipped`** in the OpenAPI types; this one adds them.
3. **The project-scoped list lives under `/api/organizations/`,** not `/api/v1/projects/`; the test reads it there.
4. `_dependencies_flow.json` was recaptured too (its rows are publishing versions); only ids changed, so it was restored.

## Not done

- The task's assignee or reviewer on a version row (Q-RP-117 B); a version count on the Tasks list.
- `shot_id`/`asset_id` filters (Q-RP-120 B); a Task filter on the Versions list itself (the task's page lists its versions); grouping by task.
- `docs/sync/samples/production/versions.json` (an early snapshot no tool writes) is unchanged.
- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.

## Files

- Backend: `apps/production/api/serializers/version/base.py`, `selectors/task.py`, `api/filtersets/version.py`; tests `apps/production/tests/test_rp26_version_task.py` (new).
- Frontend:
  - `src/api/production/review.ts`, `reviewRowKeys.ts`; `src/core/api/generated/openapi.ts`, `schema/django-openapi.yml` (regenerated);
  - `src/modules/production/review/VersionTaskCell.tsx` (new), `versions.tsx`, `versionCard.tsx`; `src/modules/production/work/TaskWorkspace.tsx`;
  - tests: `src/api/production/__tests__/versionTaskListContracts.test.ts`, `src/modules/production/work/__tests__/taskVersions.test.tsx`, `src/test/live/versionTaskList.live.test.tsx` (new); `reviewContracts.test.ts` updated.
- Docs: `docs/sync/tools/test_capture_version_task_list.py` (new); `docs/sync/samples/production/_version_task_list_flow.json` (new) and thirteen recaptured flows; `docs/review-pipeline/CONTRACTS.md`, `PLAN.md`, `DECISIONS.md`, `rp-26-verification.md` (new).
