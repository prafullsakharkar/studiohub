# Production Role Scoping — REST Contract Delta (Track 2 Input)

Status: **Track 2 complete (Django-landing) · B-3 docs sync (2026-10-01)** — backend ships Episode gating + scoped positions + person role validation + shot chain integrity; this document describes the shipped behavior as the final reference.

Upstream: `docs/superpowers/specs/2026-09-29-production-role-scoping-design.md` (§1–§6).

## 1. Endpoint delta

| Endpoint | Method | Change | Notes |
| :--- | :--- | :--- | :--- |
| `/api/organizations/{org_id}/positions/available/` | GET | **New** | Server-filtered read: enabled global masters + the org's own customs. Query param `?include=all_masters` returns every global master (regardless of enablement) plus org-visible rows — used by the org management surface to render enable toggles. |
| `/api/organizations/{org_id}/positions/` | POST/PATCH | Extended | Org-scoped position create/update must default `scope` to `organization_custom` and force `organization_id` to the path org (clients must not mint global masters). |
| `/api/organizations/{org_id}/people/` | POST/PATCH | Extended | Accepts `role_id`; the assignment is validated against the org's visible role catalog (§3). |
| `/api/v1/people/` | POST/PATCH | Extended | Same `role_id` handling; the org is resolved from `organization_id` in the payload / tenant context. |
| `/api/organizations/{org_id}/` | PATCH | Extended | `settings.enabled_master_position_ids: string[]` is writable on the org record (enablement write; no new table). |

No new top-level route surfaces; `validate-api-contract.mjs`'s allowlist was **not** widened —
the available-read is an `org-scoped positions` sub-action shape matching existing patterns.

## 2. Field delta

| Entity | Field | Type | Semantics |
| :--- | :--- | :--- | :--- |
| `Position` | `scope` | `'global_master' \| 'organization_custom'` (nullable) | Absent (`null`/omitted) = legacy row; treated as `organization_custom` for visibility. |
| `Position` | `organization_id` | `string \| null` | `null` for global masters; the owning org for customs. |
| `Organization.settings` | `enabled_master_position_ids` | `string[]` | Per-org enablement set over global masters. |
| `Person` | `role_id` | `string` (optional) | Assigned production role (Position id). Display string `role` is denormalized from the position title on assignment. |

Mock seeds pin the matrix: masters `pos-master-{animator,rigger,compositor,lighter}`
(`organization_id: null`); customs `pos-apex-creature` (Apex), `pos-vanguard-light` (Vanguard);
Apex/Vanguard/Framestore enable all four masters, Wētā (`org-weta-03`) omits
`pos-master-rigger` to exercise the disabled-master rule.

> **Note (display `role` semantics, current behavior).** The display string `role` is currently
> **client-supplied with a server-side title fallback** (client-wins): on person create/PATCH the
> mock stores `body.role` when present and only fills it with the resolved position title when
> `role_id` is sent and `role` is absent. Track 2 direction: the server should **derive `role`
> from the resolved position** whenever `role_id` is present on the write (ignoring/tightening a
> divergent client-supplied value), so the denormalized display string cannot drift from the
> assignment.

## 3. Validation rules (400 shapes)

Person create **and** PATCH resolve `role_id` against the org-visible catalog
(`isRoleAvailableForOrg` semantics — mirrored in the mock engine):

- global master → must be in `org.settings.enabled_master_position_ids`;
- custom → `position.organization_id === person.organization_id`;
- unknown/unavailable role → reject.

Violation response mirrors existing DRF field-error conventions:

```json
{
  "detail": "Role 'pos-vanguard-light' is not available to organization 'org-apex-01'.",
  "role_id": ["Role 'pos-vanguard-light' is not available to this organization."]
}
```

The same checks run on PATCH (no blind role moves across orgs). The scoped read (§1) is the
only list source for the People form, so cross-org customs are never exposed client-side.

> **Note (org-scope moves, known gap).** The validation above only runs when `role_id` is present
> in the PATCH payload against the *effective* org. A pure org-scope move — `PATCH person
> {organization_id}` **without** `role_id` — keeps the stored assignment, which today can strand a
> cross-org custom `role_id` on the moved row (e.g. an Apex custom riding along to Vanguard).
> Track 2 must either validate the stored/effective `role_id` against the effective org on every
> org move, or clear `role_id` when `organization_id` changes.

## 4. Permission mapping (assignment & management actions)

| Action | Permission | Notes |
| :--- | :--- | :--- |
| Assign/change a person's role on create | `people.create` | Person create keeps the existing `can()` gate; no new permission introduced. |
| Assign/change a person's role on edit | `people.update` | Same rule on PATCH path. |
| View org positions + enablement surface | `position.view` | Tab gate on the org workspace Positions tab. |
| Create/update org custom role | `position.create` / `position.update` | Org-scoped positions CRUD. |
| Enable/disable global masters for the org | `organization.update` / `settings.update` | PATCH on the org record (`settings.enabled_master_position_ids`). |
| Manage canonical global masters | `platform.position.*` | Platform master data surface (Super Admin). |
| Lead-department task/shot oversight | permission-evaluated | §4 remediation: `scopeEngine` TEAM scope now checks the lead-distinctive grant `shot.submit` via `evaluateUserPermission` instead of the `'Lead Artist'` name literal; role-name literals are grep-guard banned in `src/core/permissions/`. |

## 5. Frontend proof points (Track 1)

- Mocked-transport payloads: `src/modules/organization/__tests__/personRolePayloads.test.ts`
  (role_id on create/PATCH, scoped available-read URL, 404 → EmptyState tolerance).
- Assignment validation matrix: `src/mocks/__tests__/personRoleAssignment.test.ts`.
- Enablement read/toggle: `src/mocks/__tests__/positionAvailability.test.ts`,
  `src/modules/organization/components/tabs/__tests__/PositionsTabToggle.test.tsx`.
- People form (grouping, required select, edit pre-select, stale-id reset, field error):
  `src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx`.
- E2E journeys: `e2e/production-role-scoping.spec.ts` (enable → custom → assign → cross-org
  invisibility → reload; standard-role regression).

## 6. Out of scope (unchanged from spec §9)

Django implementation (Track 2); `RolesTab`/`PlatformRolesTab` access-role remodeling;
`rbac.ts` administrative name checks; department/team scoping beyond the Lead Artist rule;
theme/styling changes; new top-level management pages.
