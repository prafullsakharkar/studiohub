# StudioHub — Access Control & Layered RBAC Architecture

This document defines the canonical, platform-wide authorization and role-based access control (RBAC) model for StudioHub. It formalizes role tiers, memberships, scopes, permission evaluation, master data boundaries, and tenant isolation rules.

---

## 1. Architectural Philosophy & Core Principles

1. **Deny-by-Default**: Every request across routes, actions, entities, and APIs is denied unless an explicit rule, valid membership, authorized scope, and required permission evaluate to true.
2. **Layered Authorization Model**: Access is strictly hierarchical:
   ```text
   SUPER ADMIN
     ↓
   Global Platform
     ↓
   All Organizations
     ↓
   Global Master Data

   ORGANIZATION ADMIN
     ↓
   Explicitly Assigned Organization(s)
     ↓
   Organization Administration
     ↓
   Explicitly Granted Production Access

   PRODUCTION ADMIN
     ↓
   Explicitly Assigned Organization
     ↓
   Explicitly Assigned Project / Show Scope
     ↓
   All Production Functionality Within That Scope
   ```
3. **No Simple Global Booleans**: Authorization is NOT a flat flag. It is evaluated contextually through:
   ```text
   User
     → Organization Membership
     → Organization Role
     → Project / Show Membership
     → Production Role
     → Permissions
     → Scope
     → Resource
     → Action
   ```
4. **Backend-Enforced, Frontend-Guarded**: Client-side permission evaluators (`evaluateUserPermission`, `RoutePermissionGuard`, `usePermissionEvaluator`) protect UX, render states, and client navigation. Server and API handlers enforce strict authorization on every read, write, and mutation.

---

## 2. Role Taxonomy & Tiers

### 2.1 Platform Role (`SUPER ADMIN` / `Platform Admin`)
- **Scope**: `GLOBAL`
- **Capabilities**:
  - Global platform operations and tenant management.
  - Global master data administration (cross-tenant lookups, system catalogs, baseline schemas).
  - Unrestricted cross-organization and cross-project inspection and emergency intervention.
  - System audit logs, platform background jobs, and global telemetry.
- **Constraints**:
  - Reserved exclusively for system operators and platform maintainers.
  - Inactive platform admins (`is_active: false`) are denied immediately.

### 2.2 Organization Role (`ORGANIZATION ADMIN`, `Organization Owner`, `Organization Manager`)
- **Scope**: `ORGANIZATION`
- **Capabilities**:
  - Administration of explicitly assigned tenant organization (`org-apex-01`, etc.).
  - User management (inviting users, managing memberships, assigning departments and craft teams).
  - Organization settings, offices, departments, client profiles, and vendor rosters.
  - Access control and custom role assignment within the tenant boundary (`/organizations/:orgId/access`).
- **Constraints**:
  - **Tenant Isolation**: Strictly forbidden from accessing unassigned organizations. Cross-tenant access is rejected with HTTP 403.
  - **No Global Platform Access**: Cannot access global platform administration (`platform.*`) or global master data.
  - **Explicit Production Access**: Organization administration does NOT implicitly confer production-level data access unless explicitly granted in organization permissions (`production.admin`, `project.manage`, or `scope: ORGANIZATION`).

### 2.3 Production Role (`PRODUCTION ADMIN`, Supervisors, Producers, Artists)
- **Scope**: `PROJECT` / `SHOW`
- **Capabilities** (within assigned project/show scope):
  - Full production management across editorial, sequences, shots, assets, tasks, versions, reviews, notes, deliveries, schedule, pipeline, resources, and project settings.
  - Creating, updating, assigning, approving, and dispatching work orders.
  - Show and project configuration.
- **Constraints**:
  - **No Org-Level RBAC or Tenant Administration**: Production Admins are strictly prohibited from modifying organization-wide roles (`roles.*`), groups (`group.*`), security configurations (`security.*`), organization profiles (`organization.update`), organization deletion (`organization.delete`), billing (`billing.*`), or studio-wide user management (`people.create`, `people.delete`).
  - **No Global Platform Management**: Cannot access platform routes, platform master data, or cross-tenant facilities.
  - **Scope Isolation**: Must hold an active `ProjectMembership` for the specified `projectId` / `showId`. Cannot access unassigned projects or unassigned shows.

---

## 3. Scopes & Boundaries

Scopes restrict the blast radius of permissions and entity queries:

| Scope | Description | Applicable Roles |
| :--- | :--- | :--- |
| `GLOBAL` | Platform-wide access across all organizations and entities | Super Admin / Platform Admin |
| `ORGANIZATION` | Tenant-wide access restricted to the user's active organization | Organization Owner, Organization Admin, Organization Manager |
| `PROJECT` | Restricted to explicitly assigned project(s) via `ProjectMembership` | Production Admin, VFX Supervisor, Producer, Coordinator |
| `SHOW` | Restricted to a specific show (e.g. series season or film unit) within a project | Production Admin, Show Coordinator, Lead Artist |
| `DEPARTMENT` | Restricted to a discipline or craft department (e.g., Comp, 3D, Rigging) | Department Manager, Department Lead |
| `TEAM` | Restricted to direct team members or assigned craft squad | Lead Artist, Team Supervisor |
| `VENDOR_PROJECT` | Vendor access restricted to assigned vendor-scoped projects | Vendor Admin, Vendor Producer |
| `CLIENT_PROJECT` | Client access restricted to client-approved review playlists and deliverables | Client Admin, Client Reviewer |
| `ASSIGNED` / `OWN` | Self-access only to assigned tasks, submissions, notes, and profile | Artist, Animator, Contributor |

---

## 4. Memberships & Hierarchical Data Model

### 4.1 Organization Membership (`OrganizationMembership`)
Links a `User` to a specific tenant `Organization`:
```typescript
interface OrganizationMembership {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;               // e.g. 'Organization Admin', 'Production Admin', 'Artist'
  scope?: Scope;              // e.g. 'ORGANIZATION', 'PROJECT'
  permissions?: string[];     // Explicit overrides or supplemental permissions
  status: 'Active' | 'Invited' | 'Suspended';
}
```

### 4.2 Project Membership (`ProjectMembership`)
Grants explicit access to a `Project` and optional `Show`:
```typescript
interface ProjectMembership {
  id: string;
  user_id: string;
  project_id: string;
  show_id?: string;           // Optional show-level granularity
  role: string;               // e.g. 'Production Admin', 'Lead Artist'
  roles?: string[];           // Multi-role support
  scope?: Scope;              // 'PROJECT' or 'SHOW'
  permissions?: string[];     // Project-specific custom permission overrides
  status: 'Active' | 'Archived';
}
```

---

## 5. Effective Access Evaluation Engine

The evaluation process executes deterministically in `evaluateUserPermission`:

```text
1. Active State Check
   ├── If !user or user.is_active === false ──► DENY (false)

2. Platform Permission Check
   ├── If permission is 'platform.*' or 'page.platform_*':
   │     ├── If user.is_superuser or user.role === 'Platform Admin' ──► ALLOW (true)
   │     └── Else ──► DENY (false)

3. Super Admin Override
   ├── If user.is_superuser or Platform Admin ──► ALLOW (true)

4. Organization Boundary Check
   ├── If context.organizationId is provided:
   │     └── If !checkUserHasOrgAccess(user, context.organizationId) ──► DENY (false)

5. Production Admin Privilege Escalation Prevention
   ├── If user's effective role is 'Production Admin':
   │     └── If requested permission targets Org RBAC / Tenant Admin:
   │           ('roles.*', 'group.*', 'permissions.*', 'organization.update',
   │            'organization.delete', 'people.create', 'people.delete',
   │            'security.*', 'billing.*') ──► STRICT DENY (false)

6. Organization Owner Evaluation
   ├── If user.role === 'Organization Owner' ──► ALLOW (within org boundary)

7. Project-Scoped Evaluation (when context.projectId is provided)
   ├── Lookup getUserProjectMembership(user, projectId, organizationId)
   ├── If project membership exists:
   │     ├── If context.showId and membership is restricted to different show ──► DENY
   │     ├── If project role is Production Admin: reject org RBAC permissions
   │     ├── Union project role perms + custom perms + user perms
   │     ├── Check required permission (canonical and legacy aliases)
   │     └── If entity provided: verify isEntityInScope ──► ALLOW / DENY
   └── If NO project membership exists:
         ├── If user is Production Admin ──► DENY (no org-wide fallback!)
         ├── Check if Organization Admin has explicit production grant:
         │     ('production.*', 'production.admin', 'project.manage', 'scope: ORGANIZATION')
         │     ├── If granted: verify permission + entity scope ──► ALLOW
         │     └── Else ──► DENY
         └── Else ──► DENY

8. Organization-Scoped Evaluation (when no projectId provided)
   ├── Verify user holds active OrganizationMembership
   ├── If Production Admin: enforce org RBAC ban
   ├── Union org membership perms + user perms + org role perms
   ├── Check permission match (wildcard and canonical)
   └── If entity provided: verify isEntityInScope ──► ALLOW / DENY
```

---

## 6. Master Data vs. Organization Access

| Dimension | Global Platform Master Data | Organization Tenant Master Data |
| :--- | :--- | :--- |
| **Storage & Identification** | `is_global: true`, platform catalog IDs | `organization_id: "org-xxx"` |
| **Examples** | Standard pipeline schemas, global VFX taxonomies, platform currencies | Studio-specific asset categories, custom statuses, custom fields, internal departments |
| **Administration** | Restricted to **Super Admin** (`platform.admin`, `page.platform_master_data`) | Accessible to **Organization Admin** (`organization.view`, `organization.update`) |
| **Production Admin Access** | Read-only consumption if referenced by project pipeline | Configured within project/show pipeline settings |
| **Cross-Tenant Visibility** | Shared across all tenants as immutable reference templates | Strictly isolated to tenant boundary (`orgId === entity.organization_id`) |

---

## 7. Security Hardening & Threat Mitigations

### 7.1 Cross-Organization Isolation
- The evaluator verifies `checkUserHasOrgAccess(user, context.organizationId)` before reading memberships or permissions.
- In `isEntityInScope`, any entity whose `organization_id` does not match the active organization is denied.

### 7.2 Insecure Direct Object Reference (IDOR)
- Entity queries and permission checks evaluate `context.entity` against:
  1. Organization ownership (`entity.organization_id === userOrgId`)
  2. Project assignment (`isUserAssignedToProject(user, entity.project_id)`)
  3. Show assignment (`entity.show_id === context.showId`)
  4. Vendor/Client visibility filters (`INTERNAL`, `VENDOR`, `CLIENT`)

### 7.3 Privilege Escalation Prevention
- A Production Admin assigned to a project cannot escalate privileges by querying or mutating `/organizations/:orgId/access`.
- The Route Permission Guard rejects navigation to `/organizations/:organizationId/access` and `/access` for non-Organization Admins.
- Even if a client injects a request for `roles.create` or `people.create`, the RBAC engine hard-blocks Production Admins.

---

## 8. Verification & Test Coverage

The implementation is verified by the canonical test suite in:
- `src/__tests__/permissions/LayeredAuthorizationModel.test.ts`
- `src/__tests__/organizations/permissions/OrganizationPermissions.test.tsx`

Verified scenarios include:
- System role registry definitions for `Production Admin`.
- Super Admin global platform and master data authority.
- Organization Admin tenant boundary enforcement and cross-org access denial.
- Production Admin project/show scope authority and complete isolation from unassigned projects.
- Production Admin denial on organization RBAC, billing, and user management.
- Show-level isolation and IDOR rejection.
- Inactive user immediate rejection.
- RoutePermissionGuard route-level gating.
