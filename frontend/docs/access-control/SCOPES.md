# SCOPES — Canonical Scope Lattice & Evaluation

| | |
|---|---|
| **Document** | Phase 2 Deliverable — Canonical Scope Model |
| **Status** | Canonical Contract (agreed model for frontend × backend) |
| **Date** | 2026-09-23 |
| **Companion** | [RBAC.md](./RBAC.md) · [ACCESS-MATRIX.md](./ACCESS-MATRIX.md) |

> Scope answers **where** a permission applies; the permission answers **what** may be
> done. Effective access = permission granted **∩** scope contains the resource.
> A permission granted at a wider scope never leaks into a narrower evaluation context
> unless the user's scope covers it; a permission granted at a narrow scope never widens.

---

## 1. Canonical Scope Lattice

```text
GLOBAL (Platform)                      ── platform operators only
 └── ORGANIZATION                      ── requires active OrganizationMembership
      └── PROJECT                      ── requires active ProjectMembership
           └── SHOW                    ── show_id bound membership/grant (D2)
                └── DEPARTMENT         ── craft discipline within the production
                     └── TEAM          ── squad/unit within a department
                          └── ASSIGNED ── entities assigned to the user
                               └── OWN ── entities created by the user

External branches (never widen into internal scope):
VENDOR_PROJECT ── VENDOR_PROJECT_ASSIGNED
CLIENT_PROJECT ── CLIENT_PROJECT (approved cuts/milestones only)
```

| Scope | Boundary predicate (entity visibility) | Typical roles |
|---|---|---|
| `GLOBAL` | unrestricted (audited) | Super Admin, Platform Admin |
| `ORGANIZATION` | `entity.organization_id == membership.organization_id` | Org Owner, Org Admin, Org Manager, Executive Producer |
| `PROJECT` | `entity.project_id == membership.project_id` (org implied) | Production Admin, Producer, VFX Sup, Pipeline TD |
| `SHOW` | `entity.show_id == membership.show_id` (project implied) | Show-scoped Production Admin, Lead Artist |
| `DEPARTMENT` | `entity.department_id == user.department` (within granted production) | Department Manager, Animation/Shot/Asset Supervisors |
| `TEAM` | `entity.team_id == user.team_id` | Team Manager, Lead Artist |
| `ASSIGNED` | `entity.assignee_id == user.id` | Artist, Senior Artist, craft roles |
| `OWN` | `entity.created_by == user.id` | Viewer, Guest |
| `VENDOR_PROJECT` | `entity.vendor_id == user.vendor_id` ∧ project assigned | Vendor Admin/Manager/Artist |
| `CLIENT_PROJECT` | `entity.is_client_visible == true` ∧ `entity.client_id == user.client_id` | Client Admin/Producer/Reviewer |

`SHOW` is a **first-class** tier (Decision D2 in RBAC.md): a show-scoped grant narrows an
otherwise project-wide membership. A project-wide grant covers all its shows; a show grant
never covers its parent project's other shows.

---

## 2. Where Scope Lives

Scope exists in three places, always narrowing:

```text
Role.scope            ceiling declared by the role (backend: organization/choices/role_scope.py)
Membership.scope      actual grant — must be ⊆ role ceiling  (org membership; project/show membership)
Request context       effective evaluation scope = intersection of the above with the
                      requested {organizationId, projectId, showId}
```

- Backend evaluation: `PermissionResolver` (grant collection) + selectors'
  `scope_by_request` (queryset narrowing) + object-level checks. Phase 3 extends
  resolution to consume PROJECT/SHOW membership scope (today only organization-FK role
  scoping is evaluated — audit §4 "Partial").
- Frontend evaluation: `scopeEngine.ts` predicates under the single `can()` engine.

---

## 3. Core Evaluation Rules

1. **Scope is a ceiling, not a floor.** A role with `ORGANIZATION` scope may be granted on
   a project membership; the effective scope is PROJECT (the narrower container).
2. **Scope never promotes.** A `PROJECT` membership cannot grant org-level actions, even
   if the role's permission list contains them (see Production-Admin ban, RBAC.md §7).
3. **Cross-container references are invisible.** A SHOW-scoped user cannot see sibling
   shows, other projects in the org, or any other org — including via list endpoints,
   search, exports, and cached data.
4. **External branches are terminal.** `VENDOR_*` / `CLIENT_*` scopes cannot reach
   internal-only entities regardless of permission codes held.
5. **Deny on ambiguity.** Missing membership record, unresolved context id, or an entity
   whose scope ancestry cannot be established ⇒ DENY, not "narrower default".
6. **Superuser only at GLOBAL.** `is_superuser` bypass applies at every tier and is
   audit-logged (RBAC.md §2, §11).

---

## 4. Request Binding

| Layer | Mechanism |
|---|---|
| Organization | `X-Organization-Id` header → server resolves `Organization` + caller's membership (backend `OrganizationContextMiddleware`); client sends only an id from the server-provided `/me/organizations` list |
| Project | id from route/URL or `project_id` payload → server verifies project belongs to the org context and caller holds `ProjectMembership` |
| Show | `show_id` in route/payload → must belong to the project context; show-scoped memberships narrow further |

Note: the org/project/show ids travel client→server as *claims*; the server re-derives all
authorization state (RBAC.md §11.3). The frontend caches them only as UI context, cleared
on org switch.

---

## 5. Granting Rules (no privilege escalation by grantor)

A grantor may only create/modify memberships and role grants **within their own scope**:

- Org Admin may grant PROJECT/SHOW/DEPARTMENT/TEAM scopes + org roles below ADMIN.
- Org Owner may additionally grant ADMIN-priority org roles.
- Production Admin may grant nothing beyond their project/show (membership management of
  their own project only if explicitly permitted, e.g. `project.members.manage`).
- Platform roles are grantable only by Super Admin / Platform Admin.

---

## 6. Interaction with Sensitive Data

Field-level masking (`field.*` permissions — ACCESS-MATRIX §5) and workflow transitions
(§6) are **additional** gates *inside* a granted scope, not substitutes for scope:
financial fields stay masked even for project-scoped managers without the field
permission; client-visible playlists are readable by CLIENT_PROJECT users without any
internal field access.
