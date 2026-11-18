# RP-20 verification: per-shot grades on review copies

Built 2026-11-18 on `feature/rp-20-shot-grades`, off `develop` at `176c1ad3` (v4.16.0), with every recommendation of Q-RP-92 to Q-RP-96 ([DECISIONS.md](DECISIONS.md#rp-20-answers)). Committed `10f16b62`. Contracts C-RP-52 to C-RP-54 ([CONTRACTS.md](CONTRACTS.md#rp-20-per-shot-grades-on-review-copies)). No ADR: the trust model does not change; a note in [ADR-0041](../adr/ADR-0041-review-colour-management.md) says how the grade joins the colour transform.

Why: RP-15 applies one colour transform per project, so every shot looks the same in review. A shot graded warm and dark in the DI shows neutral and bright, and supervisors judge comp against a picture the client never sees.

## What was built

- **WP 20.1, the shot's grade (C-RP-52).**
  - `Shot.grade` (JSON, `null` by default), `grade_source` and `grade_updated_at`. `validators/grade.py` (`clean_grade`) checks the shape, the bounds, refuses booleans and text, and rounds to six places.
  - The shot's update takes `grade`. A grade equal to the stored one changes nothing; any other sets `grade_source` blank and `grade_updated_at` now (`viewsets/shot.py`, `prepare_update`). Not on create; bulk update does not take it.
  - Migration `production` `0016_rp20_shot_grades` (additive, with `Project.review_grades`).
- **WP 20.2, graded copies (C-RP-53).**
  - `Project.review_grades` (default off), on the project's shape, create and update.
  - `colour.grading_space()` (the `color_timing` role when log encoded: ACEScct in the built-in config) and `write_graded_lut()`: a copy of the studio's config gains the grade as the look `studiohub_shot_grade` in the grading space, before the project's look, and is baked for the job into its `work` folder. The cached, shared config is never changed; the graded LUT (about 7.6 MB, 0.5 s) is never cached and goes with the job's folder.
  - `ReviewMediaSelector.grade_for()` decides who gets a grade: a copy with an OpenColorIO transform, of a shot with a grade, while the switch is on. Otherwise it says why not (`no_grading_space`, `colour_config_unavailable`).
  - Processing (`_prepare_colour`, `_prepare_grade`) records `probe.grade`, `grade_source` and `grade_skipped`. A grade that cannot be baked falls back to the project's plain LUT, saying why.
  - The copies read gains `review_grades`, `grade_out_of_date` and the reason `grade`; keep (C-RP-43) records `kept_for.grade`. The project remake remakes such copies with the current grade.
- **WP 20.3, the import (C-RP-54).**
  - `transcode/cdl.py` reads `.cc`, `.ccc` and `.cdl` files. Expat refuses a DOCTYPE or an entity declaration before ElementTree reads anything, whatever the file's encoding. Namespaces are ignored, `SATNode` is taken, a missing node is the identity, and there are at most 2,000 corrections.
  - `services/grade_import.py` matches ids to shots, ignoring case: the exact code first, then the code with the project's code and `_` added or taken off. An id two shots would answer is unmatched. Only the shots the caller may update (CR-46's narrowing) are matched. Applying is atomic, with the rows locked, and writes one audit row `shot_grades_imported`.
  - `POST projects/{id}/grades/import/` (multipart, `shot.update`), its serializers and its OpenAPI schema.
- **WP 20.4, frontend.**
  - Types: `Shot.grade`, `grade_source` and `grade_updated_at`; `ShotGrade`, `GradeImport` and `GradeImportMatch`; `shotsApi.importGrades`; the probe and copies fields; `Project.review_grades`. The row keys are pinned to the captures.
  - The shot's edit page has a **Grade (ASC CDL)** editor (`ShotGradeField`: Add grade, an R/G/B grid, saturation, Clear grade). The shot's overview shows the grade and where it came from.
  - The Shots page has **Import grades…** (`GradeImport`): choosing a file runs a dry run, the dialog lists the new grades, the unmatched ids and the corrections that cannot be used, then **Apply to N shots**. It is shown with `shot.update` in the project.
  - The project form has the checkbox *Apply shot grades (ASC CDL) to colour-managed review copies*; the project's workspace shows a tag while it is on, and Duplicate keeps it.
  - The review movie panel says "Graded with the shot's CDL from <file (id)>", or why a grade was left out. The copies notice counts copies made with other grades and names `grade` among what differs.
- **WP 20.5, capture, live, docs.**
  - New capture tool `docs/sync/tools/test_capture_shot_grades.py` → `docs/sync/samples/production/_shot_grades_flow.json`. It uses real ffmpeg and the built-in config; project `RPG`; a producer (production-admin) and an artist (`shot.view` only, for the 403).
  - Recaptured nine samples (review colour, media, sequence, folder, remake, sequence copies, storage copies, rollup): only the RP-20 keys are new; the rest is ids and dates.
  - New live file `frontend/src/test/live/shotGrades.live.test.tsx`.
  - CONTRACTS, DECISIONS, PLAN, the ADR-0041 note, the pre-deploy checklist entry "From 4.16.x to 4.17.0", and `docs/api/shot-grades-import.md` for DI and pipeline tools.

## Gates

| Gate | Result |
|---|---|
| `ruff check .` | All checks passed; new files formatted; changed files formatted at HEAD are still formatted |
| `manage.py check` | no issues |
| `makemigrations --check` | No changes detected |
| basedpyright, changed and new files | 0 errors |
| Targeted backend: production, core, notifications | 2,757 passed |
| RP-20 file | 53 passed (includes one real-ffmpeg test) |
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 177 files, 1,995 tests / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| Captures (host's `/usr/bin/ffmpeg`) | RP-20 (new) and nine recaptures passed; `production_work` not recaptured (Found while building, 5) |
| Live (`SYNC_LIVE_MEDIA=1`) | `shotGrades` 4/4 (the first run failed 4/4: Found while building, 1) |

What the capture and the real-ffmpeg test show:
- The graded mid grey in the proxy matches what OpenColorIO computes for the same grade, within 4 levels (8-bit).
- A display-ready movie is never graded. A config without a grading space makes the copy with the project's transform alone and `grade_skipped: no_grading_space`.
- After a new grade, the copies read counts one copy with `why: ["grade"]`; the remake makes it again with the new grade and the count goes to 0.

## Mutation checks

- **Backend, 13 of 13 killed** (the RP-20 file; originals copied aside and byte-compared after each run, no `git stash`). Each mutation below was caught:
  - the switch ignored (copies graded while it is off);
  - a display-ready copy graded;
  - the grade applied in the input space instead of the grading space;
  - the grade not baked into the LUT;
  - the plain cached LUT copied over the graded one;
  - a dry run writing;
  - a DOCTYPE accepted;
  - no match for an id without the project's code;
  - no match for an id with the project's code added;
  - an ambiguous id matched;
  - a shot the caller cannot update written;
  - the grade left out of the differences;
  - a kept copy ignoring the grade.
- **Frontend, 11 of 11 killed.** Each mutation below was caught:
  - the create form sending the edit-only grade;
  - the grade sent as text;
  - a blank grade sent as an empty string rather than `null`;
  - choosing a file applying it;
  - Apply sending a dry run;
  - the panel's grade note left out;
  - the panel's note on a skipped grade left out;
  - the notice ignoring the grade count;
  - Add grade not starting from the neutral grade;
  - Duplicate dropping the switch;
  - Add grade without `type="button"` (found by the live run, Found while building 1).

## Deviations from the plan

1. **`probe.grade` is top-level**, beside `probe.ocio`, not inside it. `probe.ocio` keeps the shape C-RP-40 pinned, and `grade_out_of_date` compares one field.
2. **No `skipped` list in the import's answer.** A shot the caller cannot update is reported as `unmatched`, so the answer never says that a shot they cannot see exists.
3. **Ids also match the code with the project's code taken off** (`SH0010` → `RPG_SH0010`, and the other way round). CR-49 prefixes every new code, and clients name shots without it.
4. **The DOCTYPE refusal is done by Expat**, not by looking for bytes: a UTF-16 file hid the declaration from a byte check (now a test).
5. **`DirectoryFormPage` skips edit-only fields on create.** The grade is edit-only and has no value on a new record; without the skip, its JSON parse failed on create.
6. **A `jsonValue` option for entity fields** (`modules/directory/types.ts`, `formModel.ts`): the value is parsed from JSON on the way out (blank → `null`) and written as JSON on the way in.
7. **The import is on the Shots page**, beside Bulk add, not on the project page: it acts on shots and needs `shot.update`.
8. **Duplicating a project keeps `review_grades`**, as it keeps `review_burn_ins` (`CloneProjectDialog`; RP-15's view and look were never copied, and still are not). The plan did not name the dialog.
9. **The copies notice names the reason `grade`**, like `colour`: "burn-ins, colour and grade differ".

## Found while building

1. **The first live run found a bug the unit tests missed.** The shared `Button` sets no `type`, so in the shot's edit form **Add grade** and **Clear grade** submitted the form: the shot was saved with the neutral grade before anything was typed, and the edits were lost. Both buttons are now `type="button"`. The unit test's harness is now a form that fails on any submit; without the fix it fails. The shared pickers (`EntityPicker`, `EntityMultiPicker`) already set the type. The live test also waits for **Remake them**, which needs `project.update` and so `/auth/me`.
2. **The update answers the update serializer's shape.** `PATCH shots/{id}/` answers the written `grade` but not `grade_source` or `grade_updated_at`; the capture reads the shot back (`shot_typed`) for the full shape, as the RP-16 live test does for projects.
3. **The real-ffmpeg check needs the grading space.** ACES 2.0's `color_timing` role is ACEScct (log), so the grade acts as in the DI. A config whose `color_timing` is linear or missing gets no grade (`no_grading_space`): a CDL in linear light is not the grade the client approved.
4. **Two older contract tests pinned the copies read exactly** (`reviewColourContracts`, `reviewRemakeContracts`); they now include the two new keys.
5. **`test_capture_production_work.py` no longer runs** (`KeyError: 'id'`): it predates CR-49 and creates `SQ020` without the project's code, which is refused. Not an RP-20 change, and not fixed here. Its sample `_work_flow.json` is left as it is; the shot's keys are pinned to the RP-20 capture instead (`workContracts.test.ts`, test `Shot`), and that test checks that the old flow has every other key.

## Not done

- No automatic remake when a grade changes (Q-RP-96): the notice offers Remake.
- No grades on asset versions, on display-ready movies or stills, or per version; no CDL export; no grades in the browser player (the copy carries the grade).
- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.

## Files

- **Backend, new:**
  - `apps/production/validators/grade.py`, `transcode/cdl.py`, `services/grade_import.py`, `api/serializers/grade.py`
  - `apps/production/migrations/0016_rp20_shot_grades.py`
  - `apps/production/tests/test_rp20_shot_grades.py`
- **Backend, changed:**
  - `apps/production/models/{shot,project}.py`
  - `apps/production/transcode/colour.py`
  - `apps/production/selectors/review_media.py`, `services/review_media.py`
  - `apps/production/api/serializers/{review_media.py,shot/base.py,shot/update.py,project/base.py,project/create.py,project/update.py}`
  - `apps/production/api/viewsets/{shot,project}.py`
  - tests `test_rp5_review_media.py`, `test_rp14_remake.py`, `test_rp15_colour.py`, `test_rp16_sequence_copies.py` (the new keys) and `core/tests/test_bootstrap.py` (production cap 16)
- **Frontend, new:**
  - `src/modules/production/work/ShotGradeField.tsx`, `src/modules/shots/components/GradeImport.tsx`
  - tests `src/api/production/__tests__/shotGradesContracts.test.ts`, `src/modules/shots/__tests__/shotGrades.test.tsx`
  - `src/test/live/shotGrades.live.test.tsx`
- **Frontend, changed:**
  - `src/api/production/{work,review,structure}.ts` and their `*RowKeys.ts`
  - `src/modules/directory/{types.ts,formModel.ts,DirectoryFormPage.tsx}`
  - `src/modules/production/work/shots.tsx`, `src/modules/production/structure/configs.tsx`, `src/modules/production/components/{ProjectWorkspace,CloneProjectDialog}.tsx`
  - `src/modules/production/review/{ReviewMoviePanel,ReviewCopiesNotice}.tsx`
  - `src/modules/shots/components/workspace/ShotOverview.tsx`, `src/modules/shots/pages/ShotsPage.tsx`
  - tests `workContracts.test.ts`, `reviewColourContracts.test.ts`, `reviewRemakeContracts.test.ts`, `projectWorkspace.test.tsx`
  - the regenerated OpenAPI schema and types
- **Docs, new:**
  - `docs/sync/tools/test_capture_shot_grades.py`
  - `docs/sync/samples/production/_shot_grades_flow.json`
  - `docs/api/shot-grades-import.md`
  - this report
- **Docs, changed:**
  - CONTRACTS, PLAN, DECISIONS
  - ADR-0041 (note)
  - the pre-deploy checklist
  - the nine recaptured samples
