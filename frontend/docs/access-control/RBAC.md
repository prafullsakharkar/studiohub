# RBAC — Canonical Authorization Model

| | |
|---|---|
| **Document** | Phase 2 Deliverable — Canonical Authorization Architecture |
| **Status** | Canonical Contract (agreed model for frontend × backend) |
| **Date** | 2026-09-23 |
| **Companion docs** | [SCOPES.md](./SCOPES.md) · [ACCESS-MATRIX.md](./ACCESS-MATRIX.md) · [IMPLEMENTATION-AUDIT.md](./IMPLEMENTATION-AUDIT.md) |

> This is the **one authorization model** for StudioHub. The Django backend is the
> authoritative enforcer; the frontend evaluates the same model for UX gating only.
> Where existing code or docs disagree with this document, this document wins and the
> implementation must be converged in Phases 3–8.

---

## 1. Canonical Evaluation Chain

Every access decision — page load, API call, mutation, bulk action — flows through:

```text
User
  ↓  1. Authentication          valid credentials, active account
  ↓  2. Platform Role           Super Admin → GLOBAL (break-glass, logged)
  ↓  3. Organization Membership active OrganizationMembership required for org scope
  ↓  4. Organization Role       membership.role → permissions (org ceiling)
  ↓  5. Project/Show Membership required for PROJECT/SHOW scoped access
  ↓  6. Permission              resource.action code must be granted
  ↓  7. Scope                   effective scope must contain the resource (SCOPES.md)
  ↓  8. Resource                object org/project/show must match granted scope
  ↓  9. Action                  view / create / update / delete / archive / restore / publish / approve / assign / import / export / manage
  ↓
ALLOW or DENY          — deny by default; every D pass aborts immediately
```

**Deny-by-default.** Absence of an explicit grant is a DENY. Absence of a `permission_map`
entry is a DENY. An inactive membership, suspended user, or mismatched scope is a DENY.

---

## 2. Principals

| Principal | Representation | Authority | Constraints |
|---|---|---|---|
| **Super Admin** | Django `is_superuser = True` | GLOBAL — all organizations, platform ops, global master data | Break-glass; every bypass is **audit-logged**. Reserved for platform operators. Never assignable via org roles. |
| **Platform Admin** | Global `Role` (`organization = NULL`, `platform.*` codes) granted via `UserRole` | Platform-scope modules only (master data, organizations directory, platform settings) | Does **not** imply org or production access; org access still requires membership. |
| **Organization Admin / Owner / Manager** | `OrganizationMembership` with role `priority = ADMIN` (`org_admin`, `org_owner`) or MANAGER (`org_manager`) | Full administration **within explicitly assigned organizations** | No platform access. No implicit access to a second organization. Production access only via explicit grants or project membership. |
| **Production Admin** | `OrganizationMembership` (active, org context) **+ `ProjectMembership`** with `production_admin` role | Full production administration **within assigned project/show scope** | Strictly barred from org RBAC, tenant settings, billing, people management (see §7). No org-wide production fallback. |
| **Regular User** | `OrganizationMembership` + optional `ProjectMembership` | Only explicitly granted permissions within granted scope | No implicit access to anything. |

Formal role catalog (tiers 1–6, ~36 system roles) lives in
[ACCESS-MATRIX.md §1](./ACCESS-MATRIX.md); the seed source of truth is
`src/core/permissions/systemRoles.ts` (frontend template catalog) which must be
**reconciled** with backend `Role` seeds (`apps/organization`, `RolePriority`) in Phase 3.

**Decision D4 — `is_staff`.** `is_staff` is **not** an authorization tier. It grants
nothing in the API. All existing `is_staff` shortcuts in selectors, middleware, and
permission classes (`IsStaff`, legacy `organization/permissions/*.py`) are removed or
converted to explicit permission codes in Phase 3. `is_staff` retains meaning only for
Django admin access.

---

## 3. Memberships (the grant containers)

All memberships are organization-anchored, status-gated records. Only **active**
memberships grant anything. Soft-deleted, suspended, invited-not-accepted, or terminated
memberships grant nothing.

```text
OrganizationMembership (backend: apps/organization/models/membership.py — EXISTS, reuse)
  user + organization + role(Role) + status(active|on_leave|suspended|terminated)
  → grants organization-scope, ceiling = role permissions

ProjectMembership (backend: apps/production/models/project_membership.py — EXISTS, reuse)
  user + project + role/show + status
  → grants PROJECT scope within the project's organization
  → show restriction narrows to SHOW scope

(Phase 3 gap: backend must enforce ProjectMembership on flat entity endpoints and add
 SHOW-level evaluation — see §8.)
```

Frontend mirrors these as `user.memberships` / `user.project_memberships` loaded from the
backend (`/api/v1/users/me/memberships/`); the frontend never invents memberships.

---

## 4. Permission Model

### 4.1 Canonical code format (Decision D3)

```text
<resource>.<action>          singular resource, dot notation
<module>.<resource>.<action> when namespacing is required (organization.role.view, identity.user.view)
```

Canonical actions: `view · create · update · delete · archive · restore · approve ·
publish · assign · import · export · manage · configure · client_approve`

Resource families: `page.*` (UI routes), production core (`project`, `show`, `sequence`,
`shot`, `asset`, `task`, `version`, `review`, `note`, `delivery`, `timelog`, `playlist`,
`media`, `workflow`, `pipeline`, `file`, `schedule`, `analytics`), foundation
(`organization`, `membership`, `role`, `group`, `permission`, `people`, `department`,
`team`, `office`, `client`, `vendor`, `calendar`, `branding`), platform (`platform.*`,
`audit.*`, `settings.*`), field masking (`field.*`).

**Migration:** colon codes (`shots:read`, `projects:create`) in
`apps/production/constants/permissions.py` and `apps/platform/constants/permissions.py`
are legacy; they map to canonical codes (`shots:read → shot.view`, `projects:create →
project.create`). Phase 3 migrates backend constants + seeds and deletes the frontend
`LEGACY_TO_CANONICAL_MAP` shim.

### 4.2 Resolution (union semantics)

A user's effective permissions for a request context are the union of:

```text
1. UserRole grants          direct, org-scoped where role.organization is set
2. Membership role          user's active OrganizationMembership.role permissions (granted=True)
3. Group roles              GroupRole → RolePermission for live group memberships
4. Project membership role  when evaluating within a project/show context
```

then **clipped** to the effective scope ceiling (SCOPES.md §3). Backend implementation:
`apps/identity/resolvers/permission.py::PermissionResolver` (+ `PermissionCacheService`).
This chain is the single canonical resolver; the legacy
`apps/identity/authorization/checker.py` and unused `HasRole` are removed in Phase 3.

### 4.3 Deny overrides

Explicit denials always win:

- Production-Admin org-RBAC ban (§7) overrides any accumulated grant.
- Inactive user/membership anywhere in the chain → DENY.
- Scope mismatch (§ SCOPES.md) → DENY even when the permission code is granted.

---

## 5. Scope Interaction

Scope is orthogonal to permission: a permission says **what**, a scope says **where**.
Effective access requires both. Full lattice, promotion/union rules, and entity
predicates: [SCOPES.md](./SCOPES.md).

Primary tiers required by this model: **Platform (GLOBAL) → ORGANIZATION → PROJECT →
SHOW**, narrowing further to DEPARTMENT / TEAM / ASSIGNED / OWN, with external branches
VENDOR_PROJECT / CLIENT_PROJECT.

---

## 6. Canonical Evaluation Algorithm

The backend (`HasPermission` + selectors + object checks) and the frontend (`can()`)
implement this same deterministic sequence:

```text
can(user, permission, context={organizationId?, projectId?, showId?, resource?}):

 1. user exists AND user.is_active AND account not locked        else DENY
 2. user.is_superuser (Super Admin)          → audit-log → ALLOW (GLOBAL)
 3. permission ∈ platform.* :
        effective roles contain platform role (global Role grant) else DENY
 4. context.organizationId present:
        active OrganizationMembership(user, organizationId) exists else DENY
 5. Production-Admin ban: permission ∈ BANNED_ORG_ADMIN_CODES
    AND user's highest effective role scope < ORGANIZATION        else DENY
 6. context.projectId / showId present:
        verify project ∈ organization's projects                   else DENY
        active ProjectMembership(user, projectId) exists           else DENY
        showId: membership.show_id matches or is project-wide      else DENY
    else (org-only evaluation):
        non-org roles (PROJECT/SHOW-scope-only) without membership → DENY
 7. permission ∈ effective_permissions(step-4.2 union)             else DENY
 8. resource present: resource ∈ effective_scope(context)          else DENY
 ALLOW
```

This supersedes the frontend's current `evaluateUserPermission` (same shape) and becomes
the **single** engine; the store/simulation engine and fuzzy role mapping are removed in
Phase 4.

---

## 7. Tier Firewall — Production Admin Ban List

A role whose ceiling is PROJECT/SHOW never receives, regardless of grants:

```text
organization.update · organization.delete · role.* · permission.* · group.*
membership.create · membership.delete · people.create · people.delete
security.* · billing.* · platform.* · master_data.global.*
```

---

## 8. Backend Implementation Mapping (reuse-first)

| Canonical concept | Existing implementation to reuse | Phase 3/8 gap to close |
|---|---|---|
| Authentication | `apps/identity` (SimpleJWT, MFA, auth compat views) | — |
| Super Admin | `is_superuser` short-circuit in `HasPermission` (logged) | none — codify as canonical |
| Platform role | `Role.organization = NULL` (global roles) | seed platform role set; remove `is_staff` as access channel |
| Org membership | `OrganizationMembership` + services + cache invalidation | expose `/api/v1/me/organizations` (Decision D5) |
| Role/permission DB model | `Role`, `RolePermission`, `Permission`, `UserRole`, `GroupRole` | migrate production/platform codes to dot format |
| Canonical resolver | `PermissionResolver` + `PermissionCacheService` + `HasPermission` (fail-closed) | delete `AuthorizationResolver`/`PermissionChecker`, `HasRole`, legacy `organization/permissions/*` |
| Org scoping | `OrganizationBaseSelector.scope_by_request`, `OrganizationContextMiddleware` | apply `HasPermission` to ALL viewsets incl. intelligence/production plain views |
| Project membership | `ProjectMembership` + `ProjectScopeMixin` (nested routes) | enforce membership on flat entity endpoints; project-scoped queryset filtering |
| Show scoping | `Show` model, `ProjectMembership.show_id` | evaluate SHOW scope in PermissionResolver (Decision D2 — SHOW is a first-class scope) |
| Audit | `apps/audit` (tracked models, telemetry) | record authorization denials for privileged actions |

## 9. Frontend Implementation Mapping (Phase 4–6 targets)

| Canonical concept | Keep / converge to | Remove |
|---|---|---|
| Evaluation engine | `can()` from `src/core/permissions/rbac.ts` (auth-backed) as the single engine | `usePermissionStore` simulation/override mode; `mapUserRoleToEnterpriseRoleId` heuristics; duplicate catalogs; legacy cricket roles |
| Component guards | one `PermissionGate` / `PermissionButton` built on `can()` | duplicate `PermissionGate` in `usePermissions.tsx`, colliding `PermissionRoute` |
| Route guards | one fail-closed guard over the route registry | "provisioned-aware" skip in `RoutePermissionGuard`; mock-fixture tenancy resolution in `ProjectRoute` |
| Org list | `/api/v1/me/organizations` response only | client-side filtering of the full directory; `org-apex-01` defaults |

---

## 10. Canonical Decisions Record

| # | Decision | Rationale | Supersedes |
|---|---|---|---|
| **D1** | **Per-project and per-show RBAC is canonical.** `ProjectMembership` gates access to projects/shows; org membership alone grants only org-level resources. | Required by the phased plan (chain step 5, Phase 8 isolation) and the frontend baseline docs. Production-scoped staffing is a core VFX-studio requirement. | ADR-0032 decision 6 ("org-wide within a tenant, no per-project RBAC") — **a mirror ADR will be recorded in `studiohub/docs/adr/` at the start of Phase 3** when backend implementation begins. |
| **D2** | **SHOW is a first-class scope tier** between PROJECT and ASSIGNMENT. A show-level membership/role binds to `show_id` and narrows PROJECT grants. | Series/episodic pipelines operate per-show; the plan's chain and scope requirement name it. | — |
| **D3** | **Permission codes are dot-notation, singular resources**: `shot.view`, `project.create`, `organization.role.view`. Colon codes are legacy. | Matches backend `identity.*`/`organization.*` constants, frontend canonical map, ACCESS-MATRIX, and the `page.*`/`field.*` families. Only production/platform colon constants deviate. | `docs/api/permissions.md` colon style; backend `production:*`/`platform*:*` constants (migrated in Phase 3). |
| **D4** | **`is_staff` is not an authorization tier.** Only `is_superuser` (logged) and explicit global Roles confer platform access. | Removes the undocumented second privilege channel found in the audit (B5/B6-style shortcuts). | Implicit `is_staff` semantics in selectors/middleware/permission classes. |
| **D5** | **Authorized organization listing comes from `/api/v1/me/organizations`**, server-filtered. The organization switcher consumes it only. | Phase 7 requirement; eliminates client-side filtering of the directory (audit item: org access ⚠️). | Client-side filtering in `OrganizationContext`. |
| **D6** | **The platform user directory is organization-scoped.** `users` list/retrieve returns the caller's organization member directory; platform-wide visibility requires a platform role. | Tenant isolation; current open-directory behavior (audit I10) leaks cross-org user identity. | "Member-directory contract" comment in `apps/identity/api/viewsets/user.py` — change implemented in Phase 3. |

---

## 11. Security Invariants (non-negotiable)

1. Backend is the authoritative enforcer; frontend gates are UX affordances. *Hidden UI ≠ security.*
2. Every endpoint denies by default; every viewset declares explicit permission requirements.
3. Client-supplied organization/project/show ids are validated against server-resolved memberships before use.
4. Membership removal or suspension revokes access on the next request (permission cache invalidated on mutation).
5. Superuser bypass is always audit-logged; that log is itself access-restricted.
6. Organization creation initializes its default access-control dataset (roles, role-permissions, master data config) — Phase 9.
7. Audit/activity records are generated for all access-control mutations and privileged denials.

---

## Appendix — Source-of-truth pointers

| Side | Canonical artifacts |
|---|---|
| Backend | `apps/identity/permissions/permission.py` (gate) · `apps/identity/resolvers/permission.py` (resolver) · `apps/identity/services/permission_cache.py` (cache) · `apps/organization/models/{membership,role,user_role,group_role,role_permission,permission}.py` · `apps/production/models/{project_membership,show}.py` · `apps/organization/selectors/base.py` |
| Frontend | `src/core/permissions/rbac.ts` (engine — becomes sole) · `src/core/permissions/systemRoles.ts` (role seeds) · `src/core/permissions/scopeEngine.ts` (scope predicates) · `src/core/organization/OrganizationContext.tsx` (org context) |
| Docs (frontend repo) | `docs/access-control.md` (companion overview) · `docs/access-control/{RBAC,SCOPES,ACCESS-MATRIX,IMPLEMENTATION-AUDIT}.md` |
