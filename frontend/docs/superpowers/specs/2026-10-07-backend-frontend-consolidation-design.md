# Design: Backend↔Frontend Consolidation (Canonical Domain + Permission Dedup)

Date: 2026-10-07
Status: Approved (all 3 sections)
Audit: `docs/BACKEND_FRONTEND_CONSOLIDATION_REPORT.md`
Related: `docs/frontend/FUNCTIONALITY_CONSOLIDATION_{REPORT,PLAN,MATRIX}.md`

## 1. Intent

One canonical implementation per business capability across Django (`../studiohub`)
and React (this repo). Preserve functionality, authorization, isolation, audit,
search/filter/pagination, deep links, keyboard flows, workspace behavior, and
Playwright coverage. Reduce files and duplication without breaking workflows.

Assumptions: backend boundaries already correct (User≠Person, Team≠Group,
Role≠Position, Activity≠Audit proven by model reads); navigation already
canonical (no Users/People/Teams/Groups Sidebar entries; org-tabs + `/access/:section`).
No endpoint removals in this change.

## 2. Decisions (NEEDS_REVIEW resolutions)

- N1: Add nullable `Person.user` FK (email-match data migration, conflicts logged).
- N2: Constrain `ProjectMembership.status` to choices (map existing values, log unknowns).
- N3: One canonical Group manager (`GroupsManagementSection`); platform surface becomes read-only embed.
- N4: Keep ClientContact/VendorContact separate from Person.
- N5: Settings governance rule (typed = fixed keys; EAV = custom keys).
- N6: Keep `ProjectMembership.show+scope` pattern; no ShowMembership model.
- N7: Add nullable `ProjectMembership.role_ref` FK to Role; keep `role` Char as snapshot.
- N8: Rename `organization_role_permissions` table to singular via state migration.

## 3. Architecture

### 3.1 Backend migrations (`../studiohub`, Phase 1, separate session)

1. N1 `organization/models/person.py`: `user = FK(settings.AUTH_USER_MODEL,
   SET_NULL, null, blank, related_name="person_profiles")` +
   `UniqueConstraint(user, organization)` (nulls-excluded semantics per DB) +
   data migration (case-insensitive email match, org-scoped, exactly-one-match).
   Update `person` serializers/selectors/filtersets to expose `user_id`.
2. N2 `production/models/project_membership.py`: `status` → `TextChoices`
   (active/on_leave/terminated/suspended, default active) + data migration
   (`"Active"`→`active`, case-insensitive, unknown→`active` + logged).
3. N7 same model: `role_ref = FK(Role, SET_NULL, null, blank,
   related_name="project_memberships")`; backfill where `role` code matches;
   keep `role` Char + `roles` JSON untouched.
4. N8 `role_permission.py`: `AlterModelTable` to singular; no data rewrite.
5. Serializer/selector/filterset updates for new fields; no URL changes;
   legacy flat routes keep working.

### 3.2 Frontend consolidation (this repo, Phase 2)

- M1: `core/permissions/can.ts` single entry (`can/canAny/canAll`);
  `rbac.ts:can`, `accessControl.can`, `enterprisePermissions.canPerformAction`
  become deprecated aliases (warn-once, delete next release).
- M2: `isPlatformSuperuser` break-glass only; new
  `hasElevatedAccess(user, orgId)` (membership + `organization.manage`)
  replaces `isUserAdmin`/`isSuperAdminUser` and inline `role ===` /
  `roleStr.includes` in scopeEngine, resource/field/workflow/externalAccess
  engines, `PermissionControl`, `identity.ts getUserMembershipType`.
- M3: simulation stores (`usePermissionStore`, `roleStore`) opt-in overlay,
  default OFF; only `PermissionSimulatorSection` enables.
- N3: platform `GroupsSection` → read-only embed linking to access manager.
- Types: `Person.user_id` documented as real link; UI label "Production Role"
  → "Position"; `ProjectMembership.role_ref` added to `types/identity.ts`;
  `domainPermissions` `capabilities` text renamed `description`.
- No route/navigation changes.

### 3.3 Data flow

Backend FKs flow through existing serializers → namespaced + nested org APIs →
frontend types → `AsyncEntitySelector`/`BaseRESTAdapter` (org-scoped,
permission-aware, server search/pagination). No `GET all` introduced.

### 3.4 Error handling

- Ambiguous email matches / unknown statuses: log, don't force; migration is
  rerunnable and reports counts.
- Deprecated `can` aliases: `console.warn` once per session.
- Simulator overlay: explicit enable flag; prod guards fail closed when absent.

### 3.5 Testing

- Backend: `pytest backend/apps/{organization,production,identity,audit}` —
  permissions, org/project isolation, membership validation, migration tests.
- Frontend: `tsc --noEmit`, `vitest run`, `biome check src`, `api:validate`.
- Playwright (live Django): consolidation + isolation specs — Login → org →
  People/Users/Teams/Groups/Roles → project members → selector CRUD →
  permission denial → cross-org denial → direct-URL denial.
- Metrics: `find src -type f | wc -l` before (757) / after (expect −5 to −10);
  backend file count unchanged except 2–4 migration files.

## 4. Rollout

- Phase 1: backend migrations + backend tests (own session in `../studiohub`).
- Phase 2: frontend M1–M3 + N3 + types + frontend tests (this repo).
- Phase 3: Playwright + metrics + final report.
- Non-goals: endpoint removals, navigation redesign, Contactable polymorphism,
  EAV table rename (governance doc only), legacy-route sunset (needs sunset date).

## 5. Self-review

- Placeholders: none; all N-items resolved with concrete migrations.
- Consistency: §3.1 items map 1:1 to N1/N2/N7/N8; §3.2 maps to M1–M3/N3/N5-doc;
  N4/N6 are keep-decisions requiring no code.
- Scope: two repos, two phases; Phase 1 explicitly out-of-session to avoid
  cross-repo edits from here.
- Ambiguity: "exactly-one-match wins" (N1), "unknown→active + logged" (N2),
  "warn-once" (M1), "default OFF" (M3) are explicit.
