# F1a: Client/Vendor Contacts (completed, pushed 110c1c2)

## What was built
- `ClientContact`/`VendorContact` models in `apps/organization/models/{client_contact,vendor_contact}.py` (EntityModel = UUID + soft delete), migration `0010_clientcontact_vendorcontact.py`.
- Nested legacy routes in `apps/organization/api/urls_legacy.py`: `/api/v1/clients/{client_pk}/contacts/`, `/api/v1/vendors/{vendor_pk}/contacts/`; basenames `legacy-client-contact` / `legacy-vendor-contact`; reverse namespace `api:v1:organization-legacy:legacy-{client,vendor}-contact-{list,detail}` (detail kwarg `uuid`, model lookup_field `id`).
- Viewsets in `api/viewsets/contact.py` extend `OrganizationEntityViewSet`. Parent + organization derived server-side; org-scoped parent lookup for non-staff (security fix); `perform_create` raises Http404 when parent unresolvable (avoids 500 IntegrityError). `search_fields = ("name", "email", "role")` override REQUIRED because global `SearchFilter` in `config/settings/components/drf.py` DEFAULT_FILTER_BACKENDS consumes `search` using inherited `search_fields = ("code", "name")` — contacts have no `code` → FieldError 500 otherwise.
- Permissions: reuse `OrganizationPermissions` codes (`organization.view/create/update/delete`).
- seed_dev `_seed_contacts(org)`: loads `mockClientContacts`/`mockVendorContacts` from `frontend/src/mocks/db/organization/clientVendorDetails.ts` via `_load_ts_mock_array` (from `apps.production.management.commands.seed_production_mocks`); maps mock parent ids (`cli-001`/`ven-001`) → seeded codes (`WNS`/`SRP`) via mockClients/mockVendors id→code map; `update_or_create` keyed on (organization, parent, email).

## Test patterns (22 passing tests in tests/api/viewsets/test_contact_viewsets.py)
- Permission grant chain: `RoleFactory(organization=org)` + `RolePermissionFactory(role=..., permission=...)` + `UserRoleFactory(user=..., role=...)`. GOTCHA: `PermissionFactory` hardcodes `action="view"` — pass module/action explicitly per dotted code or hit `uq_permission_module_action` unique violation.
- Org header: `APIClient(..., HTTP_X_ORGANIZATION_ID=str(org.id))`.
- GOTCHA: fixture param named `client` collides with pytest-django's `client` fixture — never name test params/fixtures `client`.
- Create responses use create serializer (no `client_id`/`organization_id`/`vendor_id`, includes `id`) — codebase convention; assert writable fields on create, verify linkage via follow-up detail GET.

## Frontend integration
- `organizationApi.ts`: nested contact endpoints, list unwrap `data?.results ?? data ?? []` with `page_size: 100`.
- `useOrganizationData.ts`: `useClientContacts`/`useVendorContacts` (queryKey `['client-contacts', clientId]`) + `useClientContactMutations`/`useVendorContactMutations` with invalidate + notification pattern.
- Rewired off mocks: `ClientContactsTab`, `VendorContactsTab`, `ClientContactSelect`, `ClientOverviewTab`, `VendorOverviewTab` (overview tabs keep other mocks: contracts/POs/vendor users/teams/deliveries — no backend models yet).

## Flaky tests (pre-existing, unrelated)
`test_search_tags`, `test_search_attachments` fail occasionally in full-suite runs (search test isolation), pass isolated. Do not "fix" by weakening assertions.
