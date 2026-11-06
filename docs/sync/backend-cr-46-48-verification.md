# CR-46, CR-47, CR-48: verification

Branch `feature/episodic-bulk`. Plan and findings: `docs/episodic-bulk-discovery.md`. Change requests:
`docs/sync/backend-change-requests.md`. Contracts C-57 to C-62 (`docs/production/CONTRACTS.md`), decisions D-39 to
D-42 (`docs/production/DECISIONS.md`), the CSV formats in `docs/README.md` ("Bulk create and update").

| Commit | What |
|---|---|
| `cd774091` | CR-46: bulk update/archive/restore and `check-existence` resolve rows through the viewset's own narrowed queryset; bulk create resolves the show per item; bulk update runs the single update's checks (`prepare_update`) |
| `b7a4c692` | CR-47: episodes only on episodic projects (404 for list/detail/update/archive/bulk on a standard project, create keeps its 400); the D-12 rules in `validators/episodic.py`; `report_production_data` lists stranded episodes and links; the frontend hides episode UI on standard projects |
| `0a6e8a03` | Episodes (episodic projects) and Sequences pages in the Production nav |
| `2a18c908` | CR-48 backend: `dry_run`, `atomic`, update by code, field whitelist, 500-item cap, `errors: [{row, field, message}]`, one `AuditLog` per committed batch |
| `7d993c96` | CR-48 frontend: the Bulk menu (create/update from CSV or paste, dry-run preview, skip invalid, error report) and "Edit fields" on selected rows |
| `374b8307` | The old Bulk add managers and the code only they used removed (decision 5) |

## Tests

Backend (new or changed, all in `apps/production/tests/`):

* `security/test_bulk_scope_parity.py` (16): a show-bound, department-bound and external member get `not_found` from
  bulk update/archive/restore for rows a single PATCH would 404; `check-existence` gives no `existing_entity` for an
  unseen row; a bulk-created shot gets the member's show; a show move in bulk is refused per row, never a 500.
* `test_cr47_episodic_gating.py` (18): episode routes on standard vs episodic projects, the 400 on create, the D-12
  rules for single and bulk writes, the report command.
* `test_cr48_bulk_operations.py` (33 functions, one parametrized): dry run stores nothing and fires no events, atomic
  rolls back the whole batch, per-row partial success, the cap and flag validation, update by code (case, project,
  id/code mismatch, unseen row gives no id), parents by code, the whitelist, permission and scope per row, the flat
  error list, the audit row.
* Changed for the new behaviour: `test_episode_api.py`, `security/test_internal_narrowing.py`,
  `security/test_show_assignment.py`, `factories.py`.

Frontend: `shared/utils/__tests__/csv.test.ts`, `modules/production/bulk/__tests__/{rows.test.ts,BulkImportDialog.test.tsx}`,
`modules/production/__tests__/{StructurePages,ProjectWorkflowType}.test.tsx`, `work/__tests__/{episodicGating,shotsAssets}.test.tsx`,
`api/production/__tests__/bulkRoutes.test.ts`, `shared/components/__tests__/dialogs.test.tsx`,
`layouts/__tests__/SidebarAccessGate.test.tsx`. Every mock is a captured response.

## Mutation checks (each broke a test)

Backend: dry run committed; atomic ignored; the cap removed; the whitelist removed; no audit row; the project check of
a code match removed; the id/code mismatch check removed; a row of another project matched; the code match unscoped
(that one survived at first; the test "a row named by code that the caller cannot see gives no id" was added for it).

Frontend: the check sent without `dry_run`; skip invalid ignored; the commit button enabled with failed rows; no
refresh after a committed batch; a menu entry without its permission (survived at first; the update-only member test
was added); "Edit fields" sent non-atomic; a refused edit swallowed; the 500-row cap; the episode column on a standard
project; quoted fields; the `id` field named in the error report.

## Captures and live run

* `docs/sync/tools/test_capture_bulk_cr48.py` → `docs/sync/samples/production/_bulk_cr48_flow.json` (dry run with and
  without errors, commit, atomic failure, skip invalid, episodic dry run, over the limit, a bad flag, update by code,
  by ids, refused ids, a field outside the whitelist, shots/assets/tasks dry runs).
* `frontend/src/test/live/bulkRoutes.live.test.ts` through `docs/sync/tools/run_role_smoke.sh --vitest`: 4/4 passed
  against a factory-seeded backend on the pytest database.

## Gates

* Backend: `ruff check` clean, `manage.py check` clean, production + audit apps 1,735 passed; full suite `pytest --cov=apps` 6,898 passed (coverage 87.46%, gate 72%).
* Frontend: `pnpm typecheck`, `pnpm exec biome check src` (0 errors), `pnpm test` (125 files, 1,379 tests), `pnpm build`,
  `unreachable.mjs` (only tests, `*RowKeys.ts` and helpers).
* Quality gate: no new ruff-format or basedpyright findings in the changed backend files.
