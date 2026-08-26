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
| `organizations/` | list/create/retrieve/update/partial_update/destroy | MATCHED |
| `organizations/{id}/archive/ restore/ export/ switch/ settings/` | POST | MISSING BACKEND actions |
| `departments/` | full CRUD | MATCHED |
| `teams/` | full CRUD | MATCHED |
| `offices/` | full CRUD | MATCHED |
| `memberships/` | CRUD | MATCHED |
| `memberships` member ops: `members/add/ remove/ transfer-ownership/` | POST | MISSING BACKEND |
| `invitations/` | CRUD (+ accept/revoke per service) | MATCHED core; verify action set |

Routed but unconsumed (MISSING FRONTEND): `brandings/ calendars/ holidays/
work-calendars/ work-hours/ positions/ api-keys/ personal-access-tokens/ groups/ roles/
permissions/ user-roles/ group-members/ group-roles/ role-permissions/
organization-settings/`. Keep them; they are the RBAC/settings backbone.

## Legacy Flat Contract (prefix `/api/v1/`)

All **MISSING BACKEND** at these exact paths:

| Endpoint | Shape notes |
|---|---|
| `GET organizations/` | bare array unless `?page`/`?page_size` → then `{count,next,previous,results}` |
| `GET organizations/{id}/` | accepts id **or uppercase code** |
| `POST/PATCH/PUT/DELETE organizations/{id}/` | create requires name/code (400 field errors); nested `settings{default_fps, sso_enforced, …}` merged on update |
| `clients/` CRUD | paginated (15); fields incl. `contact_name, studio_type, active_projects[], contract_tier, total_billed_usd`; detail by id-or-code |
| `vendors/` CRUD | paginated; `specialization, security_tier, nda_signed, rating, bandwidth_gbps, active_projects[]` |
| `people/` CRUD | paginated; requires `full_name`+`email`; `role, department_id/name, team_id/name, office_id/name, skills[], seniority, availability_status, security_clearance, timezone` → maps to `organization.Person` (model exists, **no API yet**) |
| `departments/` | **bare array**; `head_id/name/avatar, member_count, color, software_stack[], capacity_hours_weekly, utilization_percentage` |
| `teams/` | **bare array**; `department_id/name, lead_id/name, member_ids[], current_project_id/code, focus_discipline, capacity_utilization` |
| `offices/` | **bare array**; embedded `holidays[{name,date,type}]`, `resources[]`, `working_hours`, `network_speed_gbps` |
| `GET billing/` | singleton StudioBilling object (**MISSING MODEL** — candidate platform domain) |
| `GET reports/` | ProductionReport[] (**MISSING MODEL**) |
| `GET notifications/` | Notification[] (**MISSING MODEL** — platform tree also needs it) |
| `GET organization/` | legacy bootstrap singleton |

## Denormalized Display Fields

Mocks return `*_id` + `*_name` pairs throughout. Serializers must include read-only
display fields resolved via selector annotations (follow the existing organization
selector pattern). This applies to every flat-contract entity.

## Mock → Model Mapping

| Mock entity | Django model | Status |
|---|---|---|
| Organization ×3 | `Organization` | exists |
| Client / Vendor | **MISSING DOMAIN MODEL** (candidates: CRM models in organization or a commercial app) | documented gap |
| Person ×7 | `Person` | model exists, API missing |
| DepartmentEntity | `Department` | exists |
| Team | `Team` | exists |
| Office | `Office` | exists |
| Organization.settings{} | `OrganizationSettings` | exists |
| StudioBilling, ProductionReport, StudioNotification | MISSING MODELS | platform scope |

## Architecture Rules

- Follow the existing directory pattern; only add components actually needed.
- If an existing organization implementation detail conflicts with the contract
  (e.g. response envelope), fix centrally and document — never fork per-endpoint.
- Member/invitation state transitions belong in services with events, not viewsets.

## Tests

Existing: `tests/api/viewsets/test_organization_viewsets.py` (organization entity),
serializers/filtersets tests. Required additions: departments/teams/offices/people CRUD
contracts, membership actions, invitation lifecycle, and legacy-alias parity tests.
