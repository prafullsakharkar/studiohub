# Production Role Scoping — Design Spec (Track 1: frontend)

Date: 2026-09-29. Status: user-approved design, pending spec review.
Program: two-track. This spec covers Track 1 (`studiohub-react`).
Track 2 (`../studiohub` Django) gets its own spec → plan cycle; its
starting input is the contract-delta appendix (§8).

## 1. Intent

Scope Production Roles by organization following the model Global
Master Role → organization enablement → person assignment, and
Organization Custom Roles belonging exclusively to one organization.
Extend the existing `Position` catalogs (frontend + mock); do not create
a parallel role entity. Resolve role permissions through the canonical
RBAC engine; never authorize on hard-coded production role names.
Preserve existing CRUD, RBAC, validation, mock/REST behavior, and theme.

Approved direction: Approach 1 (Position-catalog extension with
enablement). UI-only filtering and RBAC-engine unification were
proposed and rejected.

## 2. Current state (verified in source)

- Frontend `Position` (`src/types/organization.ts:94-99`) is
  `{id, title, department?}` with no global/custom distinction;
  Django `Position` is org-scoped with department FK, no global concept.
- `RolesTab` / `PlatformRolesTab` manage *access* roles, not craft
  roles; platform admin already lists a `'positions'` tab
  (`PlatformAdminPage.tsx:73`).
- `Person.role` is a free string; the PeopleTab invite form defaults it
  to `'Compositor'` via free-text input
  (`PeopleTab.tsx:33,279-285`); `CreatePersonPage` and edit flows share
  the pattern.
- Mock generic positions handler (`mockRouter.ts:5571`) filters
  `organization_id === target`, which would drop globals — hence §3.
- `scopeEngine.ts:370-385` grants same-department visibility on the
  hard-coded `'Lead Artist'` name — the exact pattern this spec outlaws;
  `rbac.ts:297-303` name checks are administrative access roles and are
  explicitly out of scope.
- `usePositions(params, orgId)` (`useWorkforceData.ts:15`) and
  `organizationApi.getPositions/createPosition` exist; person payloads
  flow through existing repositories.

## 3. Section 1 — Catalog model + enablement

- `Position` gains `scope: 'global_master' | 'organization_custom'`
  (existing rows default custom) and nullable `organization_id`
  (null = global master).
- Enablement lives on the org record
  (`settings.enabled_master_position_ids: string[]`): no new table,
  mock-persisted with the org, mirrored by Django in Track 2.
- New server-filtered read
  `GET /api/v1/positions/available?organization_id=` returning only
  enabled masters + own customs. CRUD routes unchanged.
- Seeds: global masters (Animator + core crafts, `organization_id`
  null); per-org customs (Creature Lead @ apex, Lighting Lead @ another
  fixture org); enablement sets wired so each org sees masters + its own
  customs only.
- Management UI: masters in the platform positions surface (Super
  Admin); customs + master enable-toggles in org `PositionsTab`
  (Organization Admin). No new top-level pages.

## 4. Section 2 — Assignment validation (mock engine)

Person create/update resolves the assigned role by id and enforces:
`person.organization_id` present; global master only if in the org's
enabled set; custom only if
`role.organization_id === person.organization_id`. Violations return
400 `role_id` field errors in the existing DRF shape. Identical checks
on PATCH (no blind role moves). The §3 read is the only list source,
so cross-org customs are never exposed server-side.

## 5. Section 3 — People form

Invite modal, `CreatePersonPage`, and edit: Production Role becomes a
required `<select>` grouped Master / Custom, sourced from the scoped
endpoint — no free-text input, no `'Compositor'` default (blank +
required, same rule as the org-form work). Edit pre-selects the
current `role_id`; selecting a role sets display `role` title;
department and email behavior unchanged.

## 6. Section 4 — RBAC remediation

Replace the `scopeEngine.ts:370` `'Lead Artist'` name check with a
permission-based department-scope check via `evaluateUserPermission`,
preserving exact same-department visibility semantics.
Behavior-preserving tests first (lead sees same-department only;
non-leads unaffected), then the swap. Person create/update keeps
existing `can()` gates; no new permissions are introduced.

## 7. Section 5 — REST, tests, Track 2 handoff

- REST: `role_id` rides existing person payloads (verify pass-through,
  add where stripped); mocked-transport tests assert the assignment
  chain; endpoints Django lacks degrade to EmptyState, never error
  spam. Live REST verification is Track 2's exit criteria.
- Unit matrix: visibility (Org A sees Animator + Creature Lead, never
  Lighting Lead; Org B mirrored), assignment (valid global-enabled,
  valid custom, disabled-global 400, cross-org custom 400, org mismatch
  400), edit pre-select, permission resolution through the engine, plus
  a grep-guard test forbidding new `=== '<RoleName>'` production checks
  outside the permission engine.
- Playwright E2E (mock): superadmin creates master → org admin enables
  + creates custom → assign to person → cross-org invisibility →
  reload → verify; plus standard regression (role flows unchanged where
  scoping is off).
- Gates for every stage: `tsc --noEmit`, `vitest run`,
  `api:validate`, `vite build`.

## 8. Appendix — contract delta for Track 2 (starting input, not final)

Position `scope` enum + nullable org link; org-level enabled-masters
set; person→role assignment triple validation with 400 field shapes
mirroring §4; `GET positions/available` semantics; permission mapping
for assignment actions. Track 2 finalizes against Django conventions
and owns migration + schema regen; frontend flips nothing (helpers
already read the new fields when present).

## 9. Out of scope

Theme or styling changes; `RolesTab`/`PlatformRolesTab` access-role
remodeling; `rbac.ts` administrative name checks; department/team
scoping changes beyond the Lead Artist rule; Django implementation
(Track 2); new top-level management pages.
