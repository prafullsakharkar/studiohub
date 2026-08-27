# Organization Domain API

`apps/organization/` is the **reference implementation** for all other domains:
models + managers + querysets + selectors + services + serializers + viewsets
(`OrganizationEntityViewSet` with `serializer_map`/`permission_map`) + filtersets +
events + tests. New endpoints anywhere in the backend must follow this pattern.

## Contract Layers

The frontend talks to organization data through **two contracts**:

1. **Legacy flat contract** (`modules/organization/hooks`, `api/organizationApi.ts`)
   — paths at `/api/v1/{organizations,clients,vendors,people,departments,teams,offices,…}/`.
   This is what the current pages actually call.
2. **Namespaced v2 contract** (`modules/organization/api/*Service.ts`)
   — `/api/v1/organization/{organizations,departments,teams,offices,memberships,invitations}/…`.

Both must work. Strategy: implement the v2 tree on the existing backend viewsets; serve
the legacy flat contract via thin routed aliases (same selectors/services) until the UI
migrates — do not fork business logic.

## Namespaced v2 (prefix `/api/v1/organization/`)

| Resource | Operations | Status |
|---|---|---|
| `organizations/` | list/create/retrieve/update/partial_update/destroy (paginated) | **MATCHED** |
| `organizations/{id}/archive/` `restore/` `export/` `switch/` | POST | **MATCHED** (Phase C: `OrganizationViewSet.archive/restore/export/switch`) |
| `organizations/{id}/settings/` | GET/PATCH | **MATCHED** (Phase C: `organization_settings` action → `OrganizationSettings`) |
| `organizations/my/` | GET | **MATCHED** (Phase C: `my` action — user's orgs) |
| `departments/` | full CRUD (paginated) | **MATCHED** |
| `teams/` | full CRUD (paginated) + `archive/` `transfer-ownership/` `members/` `members/add/` `members/remove/` | **MATCHED** (Phase C) |
| `offices/` | full CRUD (paginated) | **MATCHED** |
| `persons/` | CRUD (paginated) via `PersonViewSet` | **MATCHED** (Phase C) |
| `memberships/` | CRUD (paginated) + `bulk-update/` | **MATCHED** (Phase C: `bulk_update` action) |
| `invitations/` | CRUD (paginated) + `resend/` `accept/` `decline/` | **MATCHED** (Phase C) |

Routed but unconsumed (MISSING FRONTEND): `brandings/ calendars/ holidays/
work-calendars/ work-hours/ positions/ api-keys/ personal-access-tokens/ groups/ roles/
permissions/ user-roles/ group-members/ group-roles/ role-permissions/
organization-settings/`. Keep them; they are the RBAC/settings backbone.

## Legacy Flat Contract (prefix `/api/v1/`)

Implemented via `apps/organization/api/urls_legacy.py` (thin aliases reusing same selectors/services):

| Endpoint | Shape notes | Status |
|---|---|---|
| `GET organizations/` | bare array unless `?page`/`?page_size` → then `{count,next,previous,results}` (conditional) | **MATCHED** |
| `GET organizations/{id}/` | accepts id **or uppercase code** (`code__iexact`) | **MATCHED** |
| `POST/PATCH/PUT/DELETE organizations/{id}/` | create requires name/code (400 field errors) | **MATCHED** |
| `departments/` | **bare array** (`pagination_class=None`) | **MATCHED** |
| `teams/` | **bare array** | **MATCHED** |
| `offices/` | **bare array** | **MATCHED** |
| `people/` CRUD | paginated (`StandardPagination`); `full_name` ← `name`, `avatar_url` etc defaults via `PersonSerializer` | **MATCHED** |
| `GET organization/` | legacy bootstrap singleton → first org for user | **MATCHED** |
| `clients/` `vendors/` CRUD | paginated (15); fields incl. `contact_name, studio_type, ...` | **MISSING MODEL** — see decision below |
| `GET billing/` `GET reports/` `GET notifications/` | singletons/arrays | **MISSING MODEL** — platform scope, deferred |

## Denormalized Display Fields

Mocks return `*_id` + `*_name` pairs throughout. Serializers must include read-only
display fields resolved via selector annotations (follow the existing organization
selector pattern). This applies to every flat-contract entity.

## Mock → Model Mapping

| Mock entity | Django model | Status |
|---|---|---|
| Organization ×3 | `Organization` | exists |
| Client / Vendor | **MISSING DOMAIN MODEL** — decision: defer to Phase `commercial` app (see `docs/adr/0005-crm-deferred.md`); frontend `organizationApi` for clients/vendors will remain MSW until then | documented gap |
| Person ×7 | `Person` | **MATCHED** via `PersonViewSet` (`/api/v1/organization/persons/` + `/api/v1/people/`) |
| DepartmentEntity | `Department` | exists |
| Team | `Team` | exists |
| Office | `Office` | exists |
| Organization.settings{} | `OrganizationSettings` | exists |
| StudioBilling, ProductionReport, StudioNotification | MISSING MODELS | platform scope — deferred to `platform` domain (Phase K) |

## Architecture Rules

- Follow the existing directory pattern; only add components actually needed.
- If an existing organization implementation detail conflicts with the contract
  (e.g. response envelope), fix centrally and document — never fork per-endpoint.
- Member/invitation state transitions belong in services with events, not viewsets.

## Tests

Existing: `tests/api/viewsets/test_organization_viewsets.py` (organization entity),
serializers/filtersets tests. Required additions: departments/teams/offices/people CRUD
contracts, membership actions, invitation lifecycle, and legacy-alias parity tests.
