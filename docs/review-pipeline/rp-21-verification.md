# RP-21 verification: the task and its reviewer on the version page

Built 2026-11-19 on `feature/rp-21-version-reviewer`, off `develop` at `fbb1a370` (v4.17.1), with every recommendation of Q-RP-97 to Q-RP-100 ([DECISIONS.md](DECISIONS.md#rp-21-answers)). Not committed. Frontend only: no backend change, no migration, no new permission code or setting, and no API contract change, so there is no new C-RP contract and no ADR.

Why: the version page never named its task. Its overview showed the artist, usually empty because the Versions screen never sets it (RP-11). Since RP-19, the reviewer is told when a copy is ready, but the page they land on didn't say they review it.

## What was built

- **Three facts on the version's overview**, after *Artist* (Q-RP-97):
  - **Task:** the task's code and title, linked to `/tasks/{id}`;
  - **Assignee:** the task's `assignee_name`;
  - **Reviewer:** the task's `reviewer_name`, or **You** for the signed-in reviewer (Q-RP-99).

  An empty value shows "—", as every fact does. Nothing is edited from the page; the task's edit page sets both people (Q-RP-100).
- **Read from the task** (`GET tasks/{task_id}/`, the task page's query key), not from the version (Q-RP-98):
  - a version with no task shows none of the three and asks for nothing;
  - without `task.view`, the task is not asked for and nothing shows;
  - a refusal (404 or 403) shows nothing and no error. A client member is refused by the external scope: a client reads the versions in their reviews but no task, so the studio's assignee and reviewer never reach them;
  - any other failure shows the three facts empty;
  - while the task loads, nothing shows, so a client member never sees the facts flash and vanish.

  The query client doesn't retry a 403 or 404.
- **Capture** `docs/sync/tools/test_capture_version_task.py` → `docs/sync/samples/production/_version_task_flow.json`, with the built-in roles from `init_platform`:
  - a version on a vendor's task with an assignee and a reviewer, and that task;
  - a task without a reviewer, and a version without a task;
  - the vendor member reading both;
  - the client member reading the version and answered **404** for the task;
  - a role with `version.view` and no `task.view` answered **403**;
  - `/auth/me` for the reviewer and for the role without `task.view`.

  The tool asserts every status.
- **Tests** `modules/production/review/__tests__/versionTaskFacts.test.tsx`, 8, from the capture.
- **Live** `test/live/versionTask.live.test.tsx`, 2. The supervisor, the task's reviewer, sees the task linked, its assignee and "You". A client member in a review holding the version sees none of the three and no error. The test waits until the page's task query has failed, so the facts are hidden because of the refusal, not because the task is still loading.

## Gates

| Gate | Result |
|---|---|
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 178 files, 2,003 tests / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| `ruff check` / `ruff format` of the new tool | pass / formatted (a new file) |
| Capture | passes, every status asserted |
| Live (`run_role_smoke.sh --vitest`) | `versionTask` 2/2 |

No backend code changed, so no backend tests were run.

## Mutation checks

5 of 5 failed the tests, and the file was restored and byte-compared:

| Mutation | Failed |
|---|---|
| The task read without `task.view` | 1 |
| A 404 or 403 shown (the refusal not hidden) | 2 |
| The facts shown for a version without a task | 1 |
| "You" for anyone when the task has a reviewer | 1 |
| The Task link to the version's id | 1 |

## Found while building

1. **An external member must use two-factor authentication.** The first live run used the seeded artist as the client member. Once the artist was external, every request was refused with "Set up two-factor authentication before continuing." (`MFA_REQUIRE_EXTERNAL`, TPN TM-007). This is intended. The live test now uses the MFA-enrolled live user, given the Artist role by the manager. No product change.
2. **The task's people are names from the profile.** `assignee_name` and `reviewer_name` are the profile's display name, or the e-mail when there is none. The capture gives its users profiles, so the sample holds names, not redacted addresses.

## Not done

- The task on the Versions list or in the review player (left out by the plan).
- No live mutation run; the five mutations above are covered by the unit tests.
- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.
- The pre-deploy checklist line is written with the release.

## Files

- `frontend/src/modules/production/review/VersionWorkspace.tsx`: `VersionTaskFacts`.
- `frontend/src/modules/production/review/__tests__/versionTaskFacts.test.tsx` (new).
- `frontend/src/test/live/versionTask.live.test.tsx` (new).
- `docs/sync/tools/test_capture_version_task.py` (new), `docs/sync/samples/production/_version_task_flow.json` (new).
- `docs/review-pipeline/PLAN.md`, `DECISIONS.md`, `rp-21-verification.md` (new).
