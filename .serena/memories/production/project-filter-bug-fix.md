# Project Filter Bug — Fixed

## Symptom
Every project's Shots list returned the same 7 shots (AETH_101_040, NEB_010_010, NEB_010_020, NK_010_010, NK_010_020, NK_010_030, VEL_001_010). The `?project_id=` query param the frontend sends was being silently ignored.

## Root Cause
Frontend list hooks send `project_id=<uuid>` (plus `show_id`). Production filtersets (asset, review, sequence, shot, timelog, version, workflow) only declared `project = UUIDFilter(field_name="project_id")`. django-filter ignores undeclared params → unfiltered results. `task.py` was the correct reference (declared `project_id` alias via a `filter_project` method using `ProjectSelector.resolve_by_lookup`).

## Fix
In each of the 7 filtersets: changed `project` to `CharFilter(method="filter_project")`, added `project_id` alias, added `project_id` to `Meta.fields`, added `_org()` + `filter_project()` (resolves via `ProjectSelector.resolve_by_lookup`; unresolvable → `queryset.none()`, never 400).

Deliberately NOT added to `apps/core/filters/base.py` BaseFilterSet — that would create a forbidden core→production dependency.

## resolve_by_lookup semantics
`apps/production/selectors/project.py` `ProjectSelector.resolve_by_lookup` resolves: real UUID pk, `code` (case-insensitive), and frontend mock ids (`proj-001`→NK99, etc. via FRONTEND_MOCK_ID_TO_CODE). Returns None for unresolvable → empty result. `proj-001` resolves to code NK99, so it is NOT empty when an NK99 project exists.

## Verification
- Added 6 parametrized regression tests in `apps/production/tests/test_filter_aliases.py` (class TestProjectIdAliasAcrossResources) covering shot/asset/sequence: `?project_id=` returns only owning project's rows; unknown mock ids (`proj-999`) resolve to empty not 400.
- Full backend suite: 1848 passed (was 1842), 1 skipped, 3 subtests passed.
- Live: each project now returns only its own shots (DMQ01→0, NEB01→2 NEB, VEL01→1 VEL, AETH2→1 AETH, NK99→3 NK). UI shows "No shots found" for DMQ01.

## Gotcha: stale server
The dev server runs with `--noreload` (ps: `manage.py runserver 127.0.0.1:8000 --noreload`), so code changes do NOT auto-load. After editing backend code, restart the server (kill the runserver process and relaunch) before verifying live. Also note: raw fetch with an expired access token returns an empty/401 body that looks like a valid empty result — always refresh the token first when verifying.
