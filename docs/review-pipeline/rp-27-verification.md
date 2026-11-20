# RP-27 verification: exporting shot grades

Built 2026-11-20 on `feature/rp-27-grade-export`, off `develop` at `4637ea94` (v4.23.0), with every recommendation of Q-RP-121 to Q-RP-124 ([DECISIONS.md](DECISIONS.md#rp-27-answers)). Committed `e55bfdeb`. Contract C-RP-62 ([CONTRACTS.md](CONTRACTS.md#rp-27-exporting-shot-grades)); for tools, [docs/api/shot-grades-export.md](../api/shot-grades-export.md). No migration, permission code, setting or dependency; no ADR (who reads grades is unchanged).

Why: grades came in (RP-20's `.cc`, `.ccc`, `.cdl`; RP-22's EDL and ALE) but did not go out, so a grade typed or corrected on a shot reached nobody else unless copied by hand.

## What was built

- **The file** (WP 27.1, Q-RP-121): `cdl.write_collection(entries)` writes a `ColorCorrectionCollection` in the ASC CDL v1.01 namespace with `xml.etree.ElementTree` (every id and description escaped): per shot a `ColorCorrection` with the shot's code as `id`, a `Description` with `grade_source` when there is one, a `SOPNode` and a `SatNode`, values with six places as stored. `cdl.parse` reads it back to the same grades.
- **`GET projects/{id}/grades/export/`** (WP 27.2, Q-RP-122, Q-RP-123): `services/grade_export.py`. The project's live graded shots among those the caller reads (the Shots list's scoping, as the import uses), ordered by code; `?sequence_id=` narrows to one sequence (an unknown, malformed or other project's id gives an empty collection). `shot.view`; 403 without; 404 for a project the caller cannot open. The answer is the file: `application/xml; charset=utf-8`, `attachment; filename="<project code>_grades.ccc"`, `no-store`.
- **The audit row** (WP 27.3, Q-RP-124): one `export` row on the project per file, with the actor, the client address and `metadata` `{operation: "grades_export", file_name, sequence_id, shots}`; a refused call writes none.
- **Frontend** (WP 27.4): *Export grades…* on the Shots page beside *Import grades…*, on the same project, for holders of `shot.view`: a dialog with an optional sequence, then the download through the session (`shotsApi.exportGrades`, `ApiClient.download`), saved as `<project code>_grades.ccc`; a refusal is shown in the dialog. Regenerated OpenAPI types.
- **Docs and capture** (WP 27.5): `docs/api/shot-grades-export.md` (new), linked from the import doc; `test_capture_grade_export.py` (`production/_grade_export_flow.json`).

What the capture shows (`REX`: SH0010 and SH0020 in SQ010 typed, SH0030 in SQ020 imported from `client_reel1.ccc`, SH0040 ungraded, SH0050 graded and archived; a vendor task on SH0020):

| Request | Shots in the file |
|---|---|
| Supervisor, the project | SH0010, SH0020, SH0030 (SH0030's `Description` names `client_reel1.ccc`) |
| Supervisor, SQ010 | SH0010, SH0020 |
| Supervisor, an unknown or malformed sequence | none (200) |
| Vendor member | SH0020 |
| Client member | none (200) |
| Role without `shot.view` / outside the project | 403 / 404 (JSON) |
| The project's file imported again (dry run) | every shot `unchanged`; nothing matched, unmatched or invalid |
| Audit list, `action=EXPORT` | six rows (the four supervisor exports, the vendor's, the client's) |

## Gates

| Gate | Result |
|---|---|
| `ruff check .` | All checks passed; the new files, `cdl.py` and `viewsets/project.py` (formatted at HEAD) are formatted |
| `manage.py check` / `makemigrations --check` | no issues / No changes detected |
| basedpyright, changed files | 0 errors |
| Targeted backend: `apps/production` and `apps/core/tests/test_bootstrap.py` | 2,318 passed (19 new); RP-20's and RP-22's grade tests among them |
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 188 files, 2,091 tests (11 new) / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| Capture | `test_capture_grade_export.py` passes |
| Live (`run_role_smoke.sh --vitest`) | `gradeExport` 1/1: the supervisor exports one sequence from *Export grades…*; the saved file is `<code>_grades.ccc` and names that sequence's two graded shots with their values, and not the other sequence's |

## Mutation checks

Backend: 10 mutations, 9 failed the tests. "Ungraded shots exported" (the database filter removed) passed because the service also skips a shot without a grade when it writes the entries; with both guards removed 6 tests fail. Frontend: 4 of 4 failed. Each file was restored and byte-compared.

| Mutation | Failed |
|---|---|
| Ungraded shots exported (one guard / both guards) | 0 / 6 |
| An archived shot exported | 7 |
| The sequence filter ignored | 4 |
| A malformed sequence id not caught (500) | 1 |
| The shots list's scoping skipped | 2 |
| Values written with fewer places (the round trip changes grades) | 4 |
| The source not written | 3 |
| No audit row | 1 |
| Not ordered by code | 2 |
| `project.view` instead of `shot.view` | 2 |
| Frontend: the action shown without `shot.view` | 1 |
| Frontend: the sequence not sent | 1 |
| Frontend: saved under another name | 4 |
| Frontend: a refusal not shown | 1 |

## Found while building

1. **`Content-Disposition` is not readable cross-origin.** The backend sets no `Access-Control-Expose-Headers`, so the page cannot read the server's file name; it names the file the same way (`gradeExportName`), which the contract states and a test pins to the captured header.
2. **A task is put on a shot with `entity_type` and `entity_id`.** The task form takes no `shot` field; the capture's first try sent one and made a General task, so the vendor read no shot. The capture now checks the task names the shot. RP-21's capture sends `shot` too, and its tasks are General; it did not depend on the shot, so it was left as it is.
3. **"1 shots".** The audit row's description counts "1 shot" and "n shots".

## Not done

- ALE or EDL exports (Q-RP-121 B, C); a `.cdl` per shot or a zip of `.cc` files.
- Exporting the shots chosen on the list (Q-RP-122 B); per-version grades.
- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.

## Files

- Backend: `apps/production/transcode/cdl.py`, `services/grade_export.py` (new), `api/viewsets/project.py`; tests `apps/production/tests/test_rp27_grade_export.py` (new).
- Frontend:
  - `src/api/production/work.ts`; `src/core/api/generated/openapi.ts`, `schema/django-openapi.yml` (regenerated);
  - `src/modules/shots/components/GradeExport.tsx` (new), `pages/ShotsPage.tsx`;
  - tests: `src/api/production/__tests__/gradeExportContracts.test.ts`, `src/modules/shots/__tests__/gradeExport.test.tsx`, `src/test/live/gradeExport.live.test.tsx` (new).
- Docs: `docs/api/shot-grades-export.md` (new), `docs/api/shot-grades-import.md`; `docs/sync/tools/test_capture_grade_export.py` (new) and `docs/sync/samples/production/_grade_export_flow.json` (new); `docs/review-pipeline/CONTRACTS.md`, `PLAN.md`, `DECISIONS.md`, `rp-27-verification.md` (new).
