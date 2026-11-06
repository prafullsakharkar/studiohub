# CR-49: verification

Branch `sync/cr-49-code-prefix` (off `develop` at `0791203d`). Change request: `docs/sync/backend-change-requests.md` (CR-49,
approved by the owner 2026-11-06). Contracts C-63 to C-65 (`docs/production/CONTRACTS.md`), decision D-43
(`docs/production/DECISIONS.md`; D-10 and D-11 / Q3 superseded for create).

## What changed

| Where | What |
|---|---|
| `validators/code_prefix.py` (new) | `apply_project_code_prefix`: a new code must start with `<PROJECT.CODE>_` (any case, stored upper case) and be more than the prefix; a server-made (`derived`) code is given the prefix instead of being refused. |
| `api/viewsets/base.py`, `bulk.py` | `requires_project_code_prefix` (class flag, default off) and `_enforce_project_code_prefix`, called in `perform_create` and in the bulk item check, before the uniqueness check and `prepare_create`. So single, bulk, `dry_run` and `atomic` creates are held to the same rule. |
| `api/viewsets/{episode,sequence,shot,asset,task}.py` | opt in with `requires_project_code_prefix = True`. |
| `api/serializers/episode/create.py` | `code_was_derived`: an episode left blank (made from season and episode number) gets the prefix (`TST_EP101`). |
| `services/numbering.py` | `allocate_codes` counts and hands out the series on the full prefix (`TST_SH0010`); a `code_prefix` that already starts with the project's is not doubled. |
| `validators/episodic.py` | `apply_shot_episode_chain` also reports `sequence_id: A shot needs a sequence.` on create (not on update), together with the chain's own episode errors. |
| `management/commands/report_production_data.py` | two information sections (not findings): how many live rows of the five entities have the prefix; live shots with no sequence. |

Not changed on purpose: update, `rename-code`, bulk update by code, recovery, `check-existence`, versions, records made by services
(task templates, seeds, factories), the committed OpenAPI schema (no request or response shape changed; only 400 bodies).

## Tests

* New `apps/production/tests/test_cr49_code_prefix.py` (35): every entity, single and bulk (a bad row is `invalid` with
  `errors: [{row, field: "code", message}]`), dry run, atomic, the React form shape, the prefix alone / near misses / another
  project's prefix, a long code, a derived episode code, the uniqueness check on the prefixed code, `code_prefix` numbering, a
  shot with no sequence in bulk, and that existing records can still be edited, renamed, bulk-updated by code, recovered and
  found by `check-existence`.
* `test_shot_api.py`: a new shot needs a sequence (standard project, empty and blank values), is reported together with the missing
  episode, an unknown sequence keeps its own 400, a shot without one can still be edited. `test_shot_sequence.py`: the old
  "a shot may have no sequence" test now says required on create only. `test_report_production_data.py`: the new sections.
* About 110 existing tests created records through the API with bare codes or sequence-less shots; they now use the project's
  prefix and a sequence (`test_task_entities`, `test_numbering`, `test_sequence_episode`, `test_cr48_bulk_operations`,
  `test_cr47_episodic_gating`, `test_code_rules`, `test_catalog_types`, `test_create_through_services`, `test_frontend_contract`,
  `test_cr34_artist_membership`, the show/scope security tests, and others). Tests that expected a 400 for another reason were
  changed too, so they still fail for that reason and not for the missing prefix.
* Frontend `src/test/live/bulkRoutes.live.test.ts` (against a throwaway backend): 11/11, including a check that a bare code and a
  sequence-less shot are refused by the server for any client.

## Results

* `uv run pytest` (whole backend, no coverage): **6938 passed**, plus `test_report_production_data.py` (14 passed; its new test was
  added while the full run was going).
* `uv run ruff check .` clean; `uv run python manage.py check` clean.
* Mutation checks (break the code, expect a failure): the hook turned off (22 tests fail), the flag off for assets (2) and for tasks
  (2), the bulk call removed (8), the derived-code flag off (1), the prefix-alone check removed (2), the shot sequence check removed
  (3), its error merged badly (1), the numbering series without the project prefix (8) or doubled (1). One mutant survived, a length
  check in the hook; it was dead code (the serializer's own `max_length` always refuses first) and was removed.

## Known limits

* Records made by services are not checked, so a task made from a template keeps its own code.
* Renaming a project's code does not rename its records' codes.
* A typed code too long with the prefix on is the serializer's 400, not the hook's.
* The frontend already sent prefixed codes and a sequence (D-43 frontend part, merged earlier); scripts and other clients now get the 400s.
