# CR-56: verification

Branch `feature/studio-code-prefix`, off `develop` at `7fe8f7bf`. Change request: `docs/sync/backend-change-requests.md` CR-56, approved by the owner ("approved", 2026-11-25). The frontend part (the create forms add the prefix) is the branch's first commit, `a8ce5fa8`.

Contracts and decisions:
- masterdata DOM-MD-COD-01 to 03 and DOM-MD-BIZ-08 (`docs/masterdata/CONTRACTS.md` §5.7, §4.1);
- "Studio code prefixes" (`docs/masterdata/DECISIONS.md`).

## What changed

| Where | What |
|---|---|
| `masterdata/services/directory.py` | `DirectoryService.code_prefix` (a class attribute, `None` by default) and `_require_code_prefix`, called by `create` after field cleaning and before the uniqueness check. Update and restore do not call it. |
| `masterdata/services/organization.py`, `partner.py` | `code_prefix` on the six services: `DEPT-`, `TEAM-`, `OFF-`, `POS-`, `CLI-`, `VEN-`. |
| `masterdata/tests/test_cr56_code_prefix.py` | New: the rule for each of the six kinds (54 tests). |
| masterdata tests (7 files) | 38 tests created records with bare codes through the services or the API; they now use prefixed ones. Two test files that had been ruff-formatted were formatted again after the edit. |
| `docs/sync/tools/` (5 capture tools) | Their setup created departments, teams, clients and vendors with bare codes; now prefixed. The samples they captured earlier were **not** recaptured (they are still valid response shapes; no frontend test reads those codes). |
| frontend live tests (6 files), `e2e/live/vendors.smoke.spec.ts` | Records made through the API carry the prefix. `masterdata.live` (in the first commit) and `workspaces.live` pick a department and a person with `pickEntity`: both fields became server-searched pickers, so those two tests had been failing on `develop` already. |

Seeds (`seed_directory`, `init_platform`, `seed_dev`) already used the prefixes; `test_seed_directory_command.py` and `apps/core/tests/test_bootstrap.py` pass unchanged.

## The rule

- `POST /api/v1/departments/` with `code: "LGT"` → 400 `{"code": ["Department codes start with DEPT-."]}`; with `"DEPT-LGT"` → 201 and the code as written. The same holds on `teams/`, `positions/`, `offices/`, `clients/` and `vendors/` (the message names the kind and its prefix).
- Any case: `dept-lgt` is accepted and stored as written (trimmed, not upper-cased; the frontend sends upper case).
- The prefix alone (`DEPT-`), or a code that only begins with its letters (`DEPTLGT`), is refused.
- The prefix counts towards the length: `DEPT-` plus 25 characters fits in 30, one more is the existing length error; clients and vendors have 20 in all.
- The prefix is checked before the duplicate check, so a bare code that is also taken reports the prefix.
- A record made before the rule (a bare code) can be updated, including to another bare code, soft-deleted and restored.

## Checks

- `uv run pytest apps/masterdata`: **1,343 passed**. Also `apps/core/tests/test_bootstrap.py`, `test_contract.py`, `test_contract_regression.py`, `test_api_response_cache.py` and `test_log_redaction.py`: 71 passed. No other app creates these records through the services or the routes. Targeted tests only, not the full suite (CI runs it on push).
- Mutation checks on `_require_code_prefix`, each failing tests in `test_cr56_code_prefix.py`: no check at all (30 failures), the prefix alone allowed (6), a case-sensitive comparison (6), the check also run on update (6), the check after the duplicate check (6).
- `ruff check .`: clean. `ruff format --check` on the changed files: clean. `basedpyright` on the changed service files: one error, at `partner.py:83`, which is in code this change does not touch and was already there. `manage.py check`: no issues.
- Frontend: typecheck, Biome (0 errors), 193 files / 2,166 tests and the build, as in the first commit.
- Live, against the throwaway factory-seeded backend with this change: `departments.live` 10/10, `masterdata.live` 6/6, `audit.live`, `personWorkspace.live` 1/1, `workspaces.live` 3/3, and the browser spec `e2e/live/vendors.smoke.spec.ts` (passed).
  - In a run that shares the backend with other files, `departments.live`'s `beforeAll` (30 departments) and `personWorkspace.live` can exceed their time limits; each passes alone. The same happened on `develop`.
  - `deliveries.live` ("two drafts are cancelled together…", heading `DLV-LIVEDLV-0005` not found) fails the same way on unchanged `develop`; it is not about studio codes and is left as it is.

## Compatibility

Breaking for an API client or script that creates a department, team, position, office, client or vendor with a bare code: it now gets a 400. Existing records are untouched and stay editable. The deploy checklist entry belongs with the release that carries this branch.
