# RP-22 verification: grades from EDLs and ALEs

Built 2026-11-19 on `feature/rp-22-edl-ale-grades`, off `develop` at `876fbacb` (v4.18.0), with every recommendation of Q-RP-101 to Q-RP-104 ([DECISIONS.md](DECISIONS.md#rp-22-answers)). Committed `d5d2576c`; merged into `develop` (`e9150429`) and `main` (`1448dac6`), released in v4.19.0. CI was green on both on the first push. Contract C-RP-55, which extends C-RP-54 ([CONTRACTS.md](CONTRACTS.md#rp-22-grades-from-edls-and-ales)). No migration, no new route, permission code or setting, and no ADR: the files are text, read with no parser that fetches anything, and the trust model doesn't change.

Why: *Import grades…* read only CDL XML files (`.cc`, `.ccc`, `.cdl`). Grades that arrive in the cut's EDL (`*ASC_SOP`, `*ASC_SAT` comments) or a dailies ALE (`ASC_SOP`, `ASC_SAT` columns) had to be typed in one shot at a time.

## What was built

- **The readers** (`production/transcode/grade_files.py`, new). Each gives a list of graded entries, an id label (`event 12`, `row 3`), names and a grade, plus the number of ungraded ones. RP-20's import matches them; the grade's bounds are RP-20's `clean_grade`.
  - **EDL:**
    - events start at their number lines, and a transition's two lines are one event;
    - `*ASC_SOP` is read with or without parentheses, spaces, or a space after the `*`, in any case; `*ASC_SAT` is one number. Either alone is a grade;
    - the event's names, in order (Q-RP-101): the locators' text (whole, then each word, after the timecode and an Avid colour), the `TO` and then `FROM` clip names without the extension, the reels.
  - **ALE:**
    - the `Column` line names the columns, in any order and any case; a short row's missing cells are empty;
    - the names (Q-RP-102): the `Shot`, `VFX`, `VFX ID` and `Shot Name` cells, then `Name` without the extension.
  - **Ungraded** events and rows are counted, not listed (Q-RP-104).
  - **Text:** UTF-8, or Latin-1 when it is not UTF-8; a file with a NUL byte is "not text".
  - **Refusals (400 on `file`):** an EDL with no event; an ALE without `Column` and `Data` sections or without an `ASC_SOP` or `ASC_SAT` column; a file with no grade; more than 2,000 graded entries (ungraded ones don't count toward the cap).
- **Matching** (`services/grade_import.py`):
  - each name is looked up as an id is (the code, with or without the project's code, any case, never part of a code), and the first that matches names the shot;
  - names matching two different shots make the entry invalid;
  - a shot in several entries with the same grade is one correction; with different grades every one of them is invalid and the shot keeps its grade (Q-RP-103);
  - the source is `"<file> (event <n>: <name>)"`;
  - CDL files keep RP-20's rules: a second correction for a shot is invalid.
- **The answer** gains `ungraded` (0 for CDL files). For EDLs and ALEs, ids are `event <n>: <name>` and an unmatched one lists every name tried. The refusal for another extension now names all five.
- **Frontend** (`modules/shots/components/GradeImport.tsx`):
  - the file input accepts `.edl` and `.ale`, the label reads *Grade file*, and the dialog's text names the formats;
  - the summary counts "graded events" or "graded rows", and says "N events without a grade";
  - unmatched ids are separated by `;`, since an EDL id lists its names with commas.

  `GradeImport` gains `ungraded`, pinned in `GRADEIMPORT_KEYS`.
- **Capture** `test_capture_shot_grades.py`: a cut's EDL is added at the end of the flow, so everything before it is unchanged. It is read as a dry run and applied, and covers:
  - a locator naming the shot without the project's code;
  - a camera clip name matching nothing;
  - SH0010 cut in twice with one grade;
  - SH0030 with two grades;
  - an event naming two shots;
  - black at each end.

  Also a dailies ALE (Shot column, an ungraded row, an unmatched row), the shot written, and two refusals. Compared with the committed sample, the RP-20 entries only gain `ungraded`.
- **Docs:** `docs/api/shot-grades-import.md` (an "EDLs and ALEs" section), CONTRACTS (C-RP-55), PLAN, DECISIONS.

## Gates

| Gate | Result |
|---|---|
| `ruff check` (production) | All checks passed; the changed files were formatted at HEAD and are formatted; the new files are formatted |
| `manage.py check` / `makemigrations --check` | no issues / No changes detected |
| basedpyright, changed files | 0 errors |
| Targeted backend: `apps/production` | 2,191 passed |
| RP-22 file / RP-20 file | 22 / 53 passed |
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 178 files, 2,010 tests / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| Capture `test_capture_shot_grades.py` | passes (the host's `/usr/bin/ffmpeg`) |
| Live (`run_role_smoke.sh --vitest`) | `gradeFiles` 2/2 |

## Mutation checks

10 of 10 failed the tests, and the files were restored and byte-compared.

| Mutation | Failed |
|---|---|
| A name matching part of a code (prefix lookup) | 1 |
| The first name taken when another names a different shot | 1 |
| Different grades for one shot written | 1 |
| An ungraded event listed as invalid | 4 |
| The `TO` clip name tried after `FROM` | 2 |
| A Latin-1 file refused | 1 |
| The 2,000 cap counting ungraded events | 1 |
| Frontend: the ungraded sentence dropped | 2 |
| Frontend: `.edl` left out of the accept list | 1 |
| Frontend: an EDL counted as "corrections" | 1 |

## Found while building

1. **The live run sends the file with Node's fetch**, as RP-20's does: jsdom's `File` loses its bytes in Node's `Request`, so the dialog's upload can't be driven against a real backend. The dialog is covered by the unit tests with the captured answers. The live run checks the route, and the shot page showing "from live.edl (event 2: SH0010)".
2. **A file with no grade is refused** (400), like a CDL file with no `ColorCorrection`, rather than answered with zero corrections. A cut with no `*ASC_SOP` is almost always the wrong export. This is in C-RP-55.

## Not done

- FCPXML, AAF and OpenTimelineIO; EDL dialects other than CMX 3600 beyond the lines they share with it.
- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.

## Files

- Backend:
  - `apps/production/transcode/grade_files.py` (new);
  - `apps/production/services/grade_import.py`;
  - `apps/production/api/serializers/grade.py`;
  - `apps/production/tests/test_rp22_edl_ale_grades.py` (new);
  - `apps/production/tests/test_rp20_shot_grades.py` (the refusal's message).
- Frontend:
  - `src/modules/shots/components/GradeImport.tsx`;
  - `src/api/production/work.ts`, `workRowKeys.ts`;
  - `src/api/production/__tests__/shotGradesContracts.test.ts`;
  - `src/modules/shots/__tests__/shotGrades.test.tsx`;
  - `src/test/live/gradeFiles.live.test.tsx` (new).
- Docs:
  - `docs/sync/tools/test_capture_shot_grades.py`, `docs/sync/samples/production/_shot_grades_flow.json`;
  - `docs/api/shot-grades-import.md`;
  - `docs/review-pipeline/CONTRACTS.md`, `PLAN.md`, `DECISIONS.md`, `rp-22-verification.md` (new).
