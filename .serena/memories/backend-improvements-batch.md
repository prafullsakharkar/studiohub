# Backend improvements batch (completed, pushed 76eecd5, 55 files)

## P0 validation (contracts)
- `validators/client_contract.py` + `vendor_contract.py`: expiry>=effective (Django ValidationError→400), duplicate number→`DuplicateException` (409). Wired via `validator_class` on the two contract services. DB `UniqueConstraint`s in migration `0012_contract_unique_numbers`.
- KEY FIX in `apps/core/api/exceptions/handlers.py`: DRF does NOT handle Django ValidationError → every service-validator failure was a 500. Now Django ValidationError→400 (via `as_serializer_error`), IntegrityError→409, plus pre-existing BaseDomainException/500-JSON. `config/urls.py` has JSON `handler500`. Tests: `apps/core/tests/api/test_exception_handler.py`.

## Events
- New `events/contact.py`, `events/contract.py`, `events/billing.py`; `event_map` on the 4 contact/contract services + billing service. NOTE: Client/Vendor top-level viewsets bypass services entirely (no service_class) — deeper refactor deferred.
- Fixed REAL bug: `RolePermissionGranted/Revoked` defined in BOTH events/role.py and events/role_permission.py with different event_types; package import order masked it. Removed role.py copies.

## Restore + bulk (ADR-0028 compliant)
- `api/viewsets/nested_bulk.py`: `NestedBulkActionsMixin` (bulk-create/update/archive/restore + single restore, sequence-style envelope, org-scoped parents, per-record errors, `duplicate` status via DuplicateException). Used by all 4 contact/contract viewsets. NOTE: ADR-0028 mandates `bulk-archive` (not delete) + `archived` status — initially implemented as bulk-delete, renamed after reading the ADR.
- `restore` on ClientViewSet/VendorViewSet. Found REAL bug: client/vendor `destroy` ALWAYS 500'd (ServiceModelViewSet.perform_destroy requires service_class, which they lack). Fixed with `perform_destroy` → `soft_delete()`.
- Tests: `test_bulk_restore_viewsets.py` (22 tests).

## Roles
- `RoleViewSet.clone`, `permissions/add`, `permissions/remove` + `RoleService.clone/grant/revoke_permissions` + tests (`test_role_actions.py`, 9 tests). Uses RolePermissions.GRANT/REVOKE_PERMISSION codes.
- Fixed REAL bug: `RoleSelector` scoped non-superuser staff to `user.organizations` (empty for fixture staff) contradicting `scope_by_request` admin-context rule → staff got 404s. Now staff/superuser see all.

## Billing/knowledge/stubs (ADR-0029)
- `OrganizationBilling` model (migration 0013) backs GET/PATCH /api/v1/billing/ (PATCH staff-only, validator, service, event, seeded defaults, 7 tests). Reports/notifications → honest []. AI chat → stateless echo (removed module-global mutation + monkey-patched DELETE). `KnowledgeDocument` model (intelligence.0001) backs knowledge CRUD (same routes, 9 tests, factory, per-app fixtures/conftest convention, seeded from frontend mocks). Risks/search/analytics = documented stubs.

## Flaky tests
- Root cause: tag/attachment search covers name+description, descriptions are Faker-random and could contain the term. Fix: pinned descriptions in both tests (deterministic, same assertions). Verified 3x26 green.

## Verification
- 1601 passed (1549+52), 1 pre-existing skip, ruff clean, check clean, spectacular valid.

## Remaining backend work (explicitly out of scope)
- Client/Vendor viewsets bypass service layer (legacy style) — refactor onto services/selectors when touched next.
- LLM-backed assistant/risks/search, reporting + notification domains (need infra/decisions).
- Contract-tabs frontend rewiring (frontend task).
