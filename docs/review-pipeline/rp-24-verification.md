# RP-24 verification: waiting for my review

Built 2026-11-19 on `feature/rp-24-review-queue`, off `develop` at `0d302538` (v4.20.0), with every recommendation of Q-RP-109 to Q-RP-112 ([DECISIONS.md](DECISIONS.md#rp-24-answers)). Committed `3786373c`. Contract C-RP-58 ([CONTRACTS.md](CONTRACTS.md#rp-24-waiting-for-my-review)). No migration, no new route, permission code or setting, no field added to any answer, and no ADR.

Why: since RP-19 a task's reviewer is told when a version's copy is ready, but nothing listed what waits for them. Neither the Versions nor the Tasks list could filter by reviewer, and the dashboard counts per project.

## What was built

- **The version filter** (`versions/?to_review=mine`, Q-RP-109, Q-RP-110):
  - the live versions in `Pending Review` on a live task (not archived, not in the `Archived` status) whose reviewer is the caller;
  - only `mine`: another value, a user id included, is a 400 on the field, so the filter never says who else reviews what;
  - it narrows what the caller already reads (a vendor member's vendor tasks, a client member's reviews) and combines with the project filter, search, status, ordering and paging; no query per row.
- **The task filter** (`tasks/?reviewer_id=<id>`): read as `assignee_id`; an unknown or malformed id gives no rows, not a 400.
- **Frontend** (Q-RP-111, Q-RP-112):
  - the Versions list's filter *To review: Mine*, and the Tasks list's *Reviewer: Me*;
  - "All waiting for my review" on each "copy to review" row of the notifications page, to `/versions?to_review=mine`;
  - **every directory list now starts with the filters its address names**: only keys it offers as filters (never its scope), and for a filter with fixed choices only one of them. After that the filters are the page's own, as before. No count anywhere.
- **Capture:** the new `test_capture_review_queue.py` (`production/_review_queue_flow.json`): two supervisors, two projects, versions in each status, a task with no reviewer, a version with no task, an archived task, a client member in a review, a bad value, and the task filter with a known, an unknown and a malformed id.
- **The OpenAPI types** were regenerated: they gain the two query parameters and nothing else.

## Gates

| Gate | Result |
|---|---|
| `ruff check apps/production` | All checks passed; the two filtersets were not formatted at HEAD and are left so (hand-edited); the new test and capture tool are formatted |
| `manage.py check` / `makemigrations --check` | no issues / No changes detected |
| basedpyright, changed files | 0 errors |
| Targeted backend: `apps/production` and `apps/core/tests/test_bootstrap.py` | 2,255 passed (9 new) |
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 182 files, 2,042 tests (15 new) / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| Capture | passes |
| Live (`run_role_smoke.sh --vitest`) | `reviewQueue` 2/2 (the first run failed on the test's own match, item 5 below) |

## Mutation checks

13 of 13 failed the tests, and the files were restored and byte-compared.

| Mutation | Failed |
|---|---|
| The status not checked | 1 |
| The artist instead of the task's reviewer | 5 |
| An archived task's version listed | 1 |
| A task in the `Archived` status listed | 1 |
| Another value accepted | 1 |
| `reviewer_id` filtering by assignee | 1 |
| Frontend: the filter sends another value than `mine` | 4 |
| Frontend: the address not read | 4 |
| Frontend: any value for a fixed filter | 1 |
| Frontend: a key the list does not offer applied | 1 |
| Frontend: *Reviewer: Me* sent as `assignee_id` | 1 |
| Frontend: the link on every notice | 1 |
| Frontend: the link to the unfiltered list | 1 |

## Found while building

1. **List filters lived only in the page's state** (`usePaginatedList`), so no link could open a list filtered. Found while planning; the list page now reads its starting filters from the address, for every list, limited to what it offers.
2. **A task's versions are numbered per task** (`production_version_task_index_uniq`), so the tests give each version its own index.
3. **A filter's 400 carries the error envelope too**: `{"error": {...}, "to_review": [...]}`. The frontend's `normalizeApiError` reads the field as for any form.
4. **An archived task's versions stay in the Versions list**, as before; they are only left out of the queue.
5. **Version codes come from the shot and the department**, so two tasks' first versions in one department are `…_COMPOSITING_V001` and `…_COMPOSITING_V001_2`. The live test's first run matched a code as a substring and found both; it now matches a row's whole title.

## Not done

- Someone else's queue; versions with no reviewer; assignment rules.
- Review sessions' reviewers (Q-RP-109 B); a count in the sidebar (Q-RP-112 B); e-mail or digests (Q-RP-7 stands).
- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.
- The pre-deploy checklist line is written with the release.

## Files

- Backend: `apps/production/api/filtersets/version.py`, `task.py`; `apps/production/tests/test_rp24_review_queue.py` (new).
- Frontend:
  - `src/modules/directory/DirectoryListPage.tsx`, `src/modules/production/review/versions.tsx`, `src/modules/production/work/tasks.tsx`, `src/modules/notifications/NotificationsPage.tsx`;
  - `src/core/api/generated/openapi.ts`, `schema/django-openapi.yml` (regenerated);
  - tests: `src/modules/production/review/__tests__/reviewQueue.test.tsx`, `src/api/production/__tests__/reviewQueueContracts.test.ts` (new); `src/test/live/reviewQueue.live.test.tsx` (new).
- Docs: `docs/sync/tools/test_capture_review_queue.py` (new), `docs/sync/samples/production/_review_queue_flow.json` (new); `docs/review-pipeline/CONTRACTS.md`, `PLAN.md`, `DECISIONS.md`, `rp-24-verification.md` (new).
