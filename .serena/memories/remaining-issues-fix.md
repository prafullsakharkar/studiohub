# Remaining-issues fix session (follow-up to mock-to-real migration)

Fixed all items previously listed as remaining/pre-existing failures. Full suite now 1669 passed, 0 failed; ruff clean on apps/+config/.

## Org integration tests (9) — all stale-test issues, fixed in tests except where noted
- `OrganizationService.update/delete/archive(organization=...)` kwargs → positional `instance` (canonical BusinessService API; matches test_organization_services.py). 5 sites in integration tests + 1 in performance tests.
- `test_get_organization_by_uuid`: ORM can't query `uuid` property → `get(id=...)`, keep `.uuid` assertions (UUIDModel.uuid is alias of id).
- `test_organization_with_memberships`: removed dead `pytest.lazy_fixture` lines (plugin absent); `with_member_count` already existed.
- `test_organization_with_statistics`: implemented `OrganizationQuerySet.with_statistics()` (member/department/team/office counts) + manager passthrough + `Organization.statistics` property (getattr defaults).
- Transaction test: old mocked nonexistent `services.organization.transaction.atomic`; rewrote behaviorally (patch publish_event to raise → assert rollback, no row).
- Delete tests asserted `status == "deleted"` but canonical delete = soft-delete (flag only, status untouched per test_service_delete) → assertions aligned to is_deleted/deleted_at.

## Core queryset test
- Added `ordered()` to `OrderingQuerySetMixin` (Meta-ordering semantics mirroring BaseQuerySet.ordered); annotate `-> Self` to satisfy override compatibility (typing.Self, 3.11+).

## Ruff (9, all pre-existing files)
- Removed unused imports (action.py Callable/Any/ClassVar; contact.py + contract.py Any); UP045 in permissions/base (reverted to Optional + noqa:UP045 because repo basedpyright rejects `X | None` instance annotation there); `ruff check --fix` for 3 logging import sorts (completed a half-done _ctx_* refactor consistently).

## Intentional gaps closed
- Scheduling lists → bare arrays (5 viewsets, pagination_class=None); 8 existing tests updated from paginated assertions; stubs already returned correct shapes.
- Sequence `lead_artist` FK + `lead_artist_name` (mig 0008), serializer + filterset search; Media `code/name/title/file_name` (mig 0008), serializer + search; seed mapping in _seed_sequences/_seed_media (+lead_artist_id rewrite key); _seed_media get_or_create→update_or_create for backfill.
- SQLite opt-in: DB_ENGINE=sqlite + DB_SQLITE_PATH in config/env.py; database.py skips CONN_MAX_AGE for sqlite; .env.example docs. Verified: migrate + seed_demo_data + live server (projects, JSON metadata__project_id activity lookup, lead search, bare scheduling) all pass on SQLite.

## Gotchas
- Django `filter(id=<non-uuid str>)` raises ValidationError (not ValueError) — catch it in id-or-code resolvers (already handled).
- Strict-editor LSP ≠ repo basedpyright config; repo config is the arbiter (CI runs ruff+pytest only). Don't chase editor-only diagnostics; do fix repo-basedpyright errors on touched files.
- `transaction.atomic` bare-decorator can't be mock-patched post-import; test atomicity behaviorally.
