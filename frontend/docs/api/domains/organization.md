# Organization Domain API Specification — Removed

The `apps.organization` domain (the `Organization` model, tenant scoping,
`org_*` tables, and `/api/v1/organizations/` endpoints) was **removed** in the
org-removal work. See `docs/architecture/ORGANIZATION_REMOVAL_ADR.md`.

## What replaced it

The org domain's directory entities are now org-free platform entities hosted
by `apps.masterdata` and `apps.identity`:

| Former model | Current home | Endpoints |
| :--- | :--- | :--- |
| `Organization` | removed | — (no `/api/v1/organizations/`) |
| `Client` | `apps.masterdata` | `/api/v1/clients/` |
| `Vendor` | `apps.masterdata` | `/api/v1/vendors/` |
| `Person` | `apps.masterdata` | `/api/v1/people/` |
| `Department` | `apps.masterdata` | `/api/v1/departments/` |
| `Team` | `apps.masterdata` | `/api/v1/teams/` |
| `Office` | `apps.masterdata` | `/api/v1/offices/` |
| Roles & permissions | `apps.identity` | `/api/v1/roles/`, `/api/v1/groups/` |

## Contract changes

- No `organization_id` field in any payload; no `X-Organization-Id` header; no
  tenant query parameters.
- `/api/v1/users/me/memberships/` no longer exists (org-era endpoint). The
  frontend removed its `withMemberships` call.
- Production data isolation is enforced by project membership (see
  `docs/api/permissions.md` §4).
