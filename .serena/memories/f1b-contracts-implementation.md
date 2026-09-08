# F1b: Client/Vendor Contracts backend (completed, pushed 7574f8f)

## What was built (backend only — frontend tabs NOT yet rewired)
- `ClientContract`/`VendorContract` in `apps/organization/models/{client_contract,vendor_contract}.py` (EntityModel), migration `0011_client_vendor_contracts.py`.
- Fields mirror frontend `ClientContract`/`VendorContract` interfaces exactly: `contract_number`, `title`, `type` (default SOW client / MSA vendor), `effective_date`/`expiry_date` (nullable DateField ↔ YYYY-MM-DD strings), `value_usd` (client) / `total_value_usd` (vendor), `status` default Active, `nda_signed`, `document_url` (client only — vendor mock has none), `security_tier` (vendor only).
- MONEY DECISION: `PositiveBigIntegerField` (whole USD), NOT DecimalField — DRF renders Decimal as string, frontend declares `value_usd: number` and does arithmetic (`/1000000`, `toLocaleString()`). Verified int in seed check.
- Nested legacy routes in `urls_legacy.py` (before parent registrations): `clients/(?P<client_pk>)/contracts`, `vendors/(?P<vendor_pk>)/contracts`; basenames `legacy-client-contract` / `legacy-vendor-contract`. Viewsets in `api/viewsets/contract.py` mirror `contact.py` (org-scoped parent lookup, Http404 on missing parent, reused OrganizationPermissions).
- GOTCHA (new, beyond F1a): contracts have NO `name` field, and base `OrganizationEntityViewSet.ordering = ("name",)` is applied by DRF by default → FieldError 500 on plain list. Must override `ordering = ("contract_number",)` + explicit `ordering_fields`. (F1a's `search_fields` override lesson still applies: `("contract_number", "title")`.)
- Filtersets: status/type (iexact), nda_signed, parent id, contract_number/title icontains + SearchFilterMixin.
- Factories `ClientContractFactory` (`CON{n:04d}`) / `VendorContractFactory` (`VCON{n:04d}`) with SelfAttribute org. 22 tests in `test_contract_viewsets.py` mirroring contact tests (auth/CRUD/isolation/filtering) — all pass.
- `_seed_contracts(org)` in seed_dev.py mirrors `_seed_contacts`; keyed on (organization, parent, contract_number); seeds 5 client + 3 vendor contracts.

## Verification
- Full backend suite: 1549 passed (1527 + 22), 1 pre-existing skip, no flakes this run. ruff clean, `manage.py check` clean.

## Follow-up (not done)
- Frontend rewiring: `ClientContractsTab`, `VendorContractsTab`, `ClientOverviewTab` activeMSA lookup, workspace pages — need `organizationApi` contract endpoints + `useClientContracts`/`useVendorContracts` hooks mirroring F1a contacts work.
