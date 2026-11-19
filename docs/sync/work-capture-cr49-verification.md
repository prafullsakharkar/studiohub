# Capture tools after CR-49: verification

Done 2026-11-18 on `fix/work-capture-cr49`, off `develop` at `385a7675` (v4.17.0). Tests and docs only: no backend or product change.

Committed as `c5d0c658`; merged into `develop` (`cf9047f4`) and `main` (`e2679371`), released in v4.17.1. CI was green on both on the first push.

## The problem

CR-49 (v4.4.0) refuses a new sequence, shot, asset, task or episode whose code does not start with the project's code, and a new shot without a sequence. CR-49's verification did not rerun the capture tools, and five of them create records that way:

| Tool → sample | How it broke | Frontend files reading the sample |
|---|---|---|
| `test_capture_production_work.py` → `production/_work_flow.json` (Phase 6) | stopped on its third call (`KeyError: 'id'`) | 13 |
| `test_capture_production_structure.py` → `production/_structure_flow.json` (Phase 5) | ran, but recorded its sequence and second-episode creates as 400, and the patch, archive and restore after them as 404 or 400 | 16 |
| `test_capture_publishing.py` → `publishing/_flow.json` | stopped at its sequence (`KeyError: 'id'`) | 5 |
| `test_capture_bulk_cr48.py` → `production/_bulk_cr48_flow.json` | stopped at its sequence (an assertion) | 3 |
| `test_capture_workspaces.py` → `production/_workspaces_flow.json` | stopped at its sequence (an assertion) | 4 |

So those frontend tests were pinned to responses captured before CR-49. Found while building RP-20 ([rp-20-verification.md](../review-pipeline/rp-20-verification.md), Found while building 5), where the shot's new keys could not be pinned to `_work_flow.json`.

## The fix

- **The tools.** Every new code starts with its project's code (`WORK_SH0010`, `ALPHA_SQ010`, `PUB_SH0010`, `STD_SQ020` and `EPIC_SQA`, `WS18_SH0010`), and every new shot names a sequence.
  - Codes that refer to a record follow it: `sequence_id: "STD_SQ010"`, `entity_id: "STD_SH010"`, a note's text and search (`WS18_SH0010`).
  - The deliberate failures still fail for their own reason only:
    - a duplicate (`work_sh0010`, `std_sq010`);
    - a bad code (`STD_BAD/CODE`);
    - a bad frame range or an unknown category;
    - the 500-item limit;
    - a missing episode or parent;
    - an artist's create.
  - The episode an episodic project starts with is made by the server and is still `EP101`. CR-49 does not check records the server makes, so `episodes_create` (`EP101`) is still the duplicate it was. Master-data task types (`comp`, `roto`) are not production codes.
  - **The workspaces tool's clone request** now sends what the Duplicate dialog sends: the approval roll-up, burn-ins and shot grades as well as the settings. The server accepts it (201). The old capture's project had none of those fields, so the dialog's request was never shown to be accepted (below).
- **The five samples**, recaptured (pytest test database, rolled back).
- **Frontend tests**, values only:
  - `workContracts.test.ts`: the shot's keys are pinned to this flow again, and RP-20's workaround is removed. The prefixed codes are `WORK_SH0015`, `WORK_SH0020_COMP`/`_ROTO`, `WORK_SH7777` and `WORK_ZZZ_NEW`.
  - `template.test.ts`: `ALPHA_SQ010` under `ALPHA_EP150`, and the example code `ALPHA_SQ010_0100`.
  - `rows.test.ts`: the captured requests are `STD_SQ020` and `STD_SQ010`.
  - `StagedBulkManager.test.tsx`: its helper added the test project's code to the captured bare codes. It now swaps the capture's project code (`STD`, `EPIC`, `ALPHA`, `WORK`) for the test project's. A task's CSV names its shot as stored (`STD_SH010`): the screen sends references as typed and prefixes only new codes.
  - `workspaceContracts.test.ts`: the captured clone request has the dialog's 12 keys.

## What the recaptures show

Compared with the committed samples, entry by entry:

- **No status changed** in the work, publishing, bulk and workspaces flows. In the structure flow, the six calls CR-49 broke answer as they did before it.
- **The bulk rows' errors are the same**, field and message, apart from the codes they name.
- **No key was removed**, except `budget_usd` for a plain member in the structure flow, which CR-55 meant. The keys added are all from later phases, each already pinned from its own capture:
  - the shot's grade (RP-20);
  - the bulk answer's `atomic`, `committed`, `dry_run` and `errors` (CR-48);
  - the member's show (CR-36);
  - the project's review and approval settings (RP-12, RP-15, RP-18, RP-20, the roll-up);
  - the note's links, mentions and replies, and the published file's dependency counts and `review_copy_refusal` (RP-4, RP-17).
- **Renamed entries** are only filter probes whose names carry an id or a code.
- **One real gap was found.** The Duplicate dialog copies `approve_task_on_version_approval`, `review_burn_ins` and (since RP-20) `review_grades`, but no capture showed the server accepting them on create. With the new capture it does (201), and the two clone tests pin it.

## Also checked

- **Ran unchanged against the current backend** (written to the scratchpad and compared with the committed samples): dashboards, notifications, production review, production notes, publishing depth, review notifications. No status changed. The RP-14 to RP-20 tools were recaptured during RP-20 and RP-19.
- **Not run:** `test_capture_samples.py`, the Phase 0 tool. It seeds with factories, not the API, so CR-49 does not apply, and it needs the Phase 0 route list (`SYNC_SCRATCH/routes.tsv`), which is not in the repository.

## Gates

| Gate | Result |
|---|---|
| Captures | the five tools pass |
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 177 files, 1,995 tests / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| `ruff check` of the tools | the same findings as at HEAD (`SIM115`, as in every capture tool); left unformatted, as at HEAD |
| Mutations | a key removed from the work flow's shot fails `Shot` and the list-and-detail check; the retarget without its swap fails 7 bulk tests; the dialog not copying the roll-up fails both clone tests |

## Not done

- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.
