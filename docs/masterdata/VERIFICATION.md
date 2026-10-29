# Masterdata hardening: final verification (Phase 8, WP 8.6)

Date: 2026-10-23. Branch `feature/masterdata-hardening`. Every claim below is backed by a command
that was run or a test that exists; anything not run is said so.

## 1. Commands and results

| Check | Command | Result |
|---|---|---|
| Full test suite | `uv run pytest` (project coverage config) | **3373 passed, 1 skipped, 0 failed**, coverage 82.24% (gate 72%), 45 min 36 s. The skip is the old `test_contract.py` "No user for pagination test". (Phase 0 baseline: 2123 passed, 1 skipped.) |
| Lint | `uv run ruff check .` | clean |
| Migration drift | `uv run python manage.py makemigrations --check --dry-run` | "No changes detected" |
| System check | `uv run python manage.py check` | no issues in masterdata; one pre-existing Identity warning (`identity.W003`, MFA encryption off) |
| Format, changed files | `uv run ruff format --check <files>` | clean for every file created or fully owned by this work. `init_platform.py`, `test_contract_regression.py`, `seed_dev.py`, `seed_demo_data.py`, `test_seed_studiohub.py`, `core/api/exceptions/handlers.py` carry formatting violations that existed before; their hunk counts did not grow. Not reformatted (it would bury the real diffs). |
| Types, changed files | `uv run basedpyright <files>` | no new errors in any changed file; the remaining ones (`change_tracking.py` dict type args, `handlers.py:322`, `structlog_config.py`, `seed_dev.py`, `seed_demo_data.py`, `test_seed_studiohub.py`) are identical in count to `HEAD` before the work |
| Docs links | `python3 scripts/check_docs_links.py` | all relative links resolve |
| Migrations, forward from empty | `migrate` on a guarded scratch SQLite database (settings asserted to point at the scratch file, then deleted) | all apps migrate; `masterdata` 0001 to 0009 applied |
| Migrations, backward and forward again | same database: `migrate masterdata 0004`, then `migrate` | reverses 0009 to 0005 and re-applies cleanly |
| Migrations, populated database | verified once at Phase 8 with `tests/test_migration_0005.py` ... `test_migration_0009.py` on the PostgreSQL test database (forward, backward, data survives, conflicting data stops the migration with a list); those tests were later removed from the suite because each took 12-25 s to set up and the migrations are applied (see git history) | each: forward, backward, data survives, conflicting data stops the migration with a list |
| Concurrency | `tests/api/test_*concurrency.py` on PostgreSQL | exactly one winner, never a 500: duplicate catalog code, overlapping contracts, primary contact, hierarchy cycle, headquarters, user link. Repeated runs were green after the lock-order fix. |
| `pip-audit` / `bandit` | not run | new tools, not approved |

## 2. AUDIT findings re-checked

Status: **CLOSED** = fixed and tested; **PARTIAL** = reduced, with the remainder named; **OUT OF SCOPE** = flagged, not ours.

| ID | Status | Evidence |
|---|---|---|
| H1 PII readable by everyone | CLOSED (Phase 5, 6) | `tests/api/test_partner_api.py` (`TestH1Gating`, `TestContactsArePurelySensitive`), `tests/api/test_person_gating.py`, `tests/test_query_redaction.py`, `tests/test_change_log_redaction.py`, ADR-0037 |
| H2 no service layer | CLOSED (Phases 3 to 6) | every write is a service; `tests/integration/test_cross_module.py` proves each write route is guarded; service tests under `tests/services/` |
| H3 soft delete ignores references | CLOSED (Phase 6) | `tests/services/test_organization_services.py::TestDeleteAndRestore`, `tests/integration/test_cross_module.py::TestOtherAppsKeepReferencingMasterdata` |
| H4 PII in `ChangeLog` | CLOSED for masterdata (Phase 5); retention and append-only enforcement of `ChangeLog` stay in `apps/audit` | `tests/test_change_log_redaction.py` (found and fixed a leak through the "before" snapshot and the target label) |
| H5 broken creates | CLOSED (Phase 4) | `tests/api/test_software_api.py`, `tests/test_versioning.py`, file-type tests in `tests/api/test_lookup_catalog_api.py` |
| M1 code uniqueness | CLOSED (Phases 3 to 6) | partial `Lower()` unique constraints; `tests/models/*constraints*.py` |
| M2 org dimension survives as a column | CLOSED (Phase 7) | migration 0009; `TestNoOrganizationLeftovers`; `tests/test_migration_0009.py` (removed later, see git history) |
| M3 hierarchy cycles | CLOSED (Phase 6) | `TestHierarchy`, `tests/models/test_directory_constraints.py`, cycle race test |
| M4 contracts and contacts | CLOSED (Phase 5) | `tests/services/test_contract_services.py`, `tests/models/test_partner_constraints.py`, `tests/api/test_partner_concurrency.py` |
| M5 lifecycle | CLOSED (Phase 3 to 6) | status enums, `is_system` enforced, DELETE soft-deletes everywhere |
| M6 N+1 on software list | CLOSED (Phase 4) | annotated `version_count`; `tests/api/test_software_api.py` |
| M7 OpenAPI | CLOSED (Phase 8) | `tests/api/test_schema_snapshot.py` + `api/schema.py` |
| M8 authorization model | PARTIAL | codes split, legacy codes removed (Phase 8), exact role sets pinned (`tests/permissions/`). **FU-1 open**: `org-admin` still holds `masterdata.catalog.manage`. |
| M9 Identity link | CLOSED (Phase 6) | `tests/services/test_person_services.py::TestLink`, `::TestOwnedByIdentity`, link race test |
| M10 Person duplicates Profile | PARTIAL | name and e-mail follow Identity while linked; `phone` and `timezone` remain on Person as HR data |
| M11 DB error `DETAIL` in logs | CLOSED (Phase 5, core change) | `apps/core/tests/test_db_detail_redaction.py` |
| M12 CASCADE deletes | CLOSED | `PROTECT` on contact, contract and version foreign keys; `tests/models/test_partner_constraints.py` |
| M13 duplication / seeders disagree | CLOSED (Phase 3) | one generic catalog viewset and service; `TestSeedMasterdataCatalogRules` |
| M14 test coverage | CLOSED | 1223 masterdata tests (the audit found 12 for 19 tables): constraints, services, API matrices, authorization, concurrency, migrations, OpenAPI, admin, cross-module |
| L1 no admin | CLOSED (Phase 8) | read-only `admin.py`; `tests/test_admin.py` |
| L2 stale docs and dead code | CLOSED (Phases 7, 8) | `docs/architecture/MASTER_DATA.md`, `docs/apps/masterdata.md`, `docs/api/domains/masterdata.md` |
| L3 gates on touched files | PARTIAL | clean for new files; the pre-existing repo-wide violations listed above remain |
| L4 stored statistics | PARTIAL | client/vendor counts and department/team utilization omitted from the API; `Office.headcount` computed. The stored columns remain (dropping loses data; needs your approval). |
| L5 money types | PARTIAL | `currency` added, rating bounded, billed total nullable; contract values stay whole-unit integers while the billed total is a 2-decimal number |
| L6 production statuses are free text | OUT OF SCOPE | flagged for the production roadmap |
| L7 `IsDepartmentManager` always true | OUT OF SCOPE | flagged; lives in Identity |

## 3. Follow-ups that need a decision

1. **FU-1**: move `masterdata.catalog.manage` from `org-admin` to a platform-level role; decide who holds `masterdata.hard_delete`.
2. Drop the unused stored columns (`Client.active_projects`, `Vendor.active_projects`, `Vendor.active_tasks_count`, `Office.headcount`, `Department.capacity_hours_weekly`, `Department.utilization_percentage`, `Team.utilization_percentage`) or feed them from a selector the owning app exposes.
3. Catalog caching with version-key invalidation (D7), only if measurements justify it.
4. Verify that the dev and production database role can `CREATE EXTENSION btree_gist` before running migration 0007 there (verified only on the test database).
5. `ChangeLog` retention and append-only enforcement (`apps/audit`), `L6`, `L7`.
6. The frontend: `PlatformOverviewTab` must stop reading `total_custom_records_across_orgs`; the generated API client should be regenerated; the per-phase "Frontend-facing contract changes" lists in `DECISIONS.md` are the checklist.
