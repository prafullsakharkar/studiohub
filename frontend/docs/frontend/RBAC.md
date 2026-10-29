# Role-Based Access Control (RBAC) Architecture

StudioHub implements an enterprise-grade, multi-tenant, contextual Role-Based Access Control (RBAC) model specifically engineered for VFX, Animation, and Film Production studios.

---

## 1. Core Principles

1. **Contextual Role Resolution**: A single user identity can hold distinct roles across organizations and projects (e.g. *VFX Producer* on Project A, *Artist* on Project B).
2. **Backend Authoritative Enforcement**: The client permissions evaluate UI state and affordances, but all MSW/API gateway endpoints rigorously evaluate tokens, memberships, scopes, and resource attributes.
3. **Zero Security through Obscurity**: Hiding UI buttons or navigation links is not considered security; unauthorized API calls explicitly return HTTP `403 Forbidden` or `404 Not Found`.
4. **Scope-Aware Granting**: Permissions are evaluated alongside geographic/domain scopes: `GLOBAL`, `ORGANIZATION`, `PROJECT`, `DEPARTMENT`, `TEAM`, `VENDOR`, `CLIENT`, `ASSIGNED`, and `OWN`.

---

## 2. Identity & Membership Hierarchy

```text
User Identity (Universal Authenticated Entity)
  │
  ├── Organization Membership [1..*]
  │     ├── Organization ID (Tenant Barrier)
  │     ├── Organization Roles (e.g. Org Admin, Producer, Artist)
  │     ├── Department & Office Affiliations
  │     └── Direct Permission Overrides
  │
  ├── Project Membership [0..*]
  │     ├── Project ID (Show Barrier)
  │     ├── Contextual Project Roles (e.g. Lead Artist, Reviewer, Vendor)
  │     ├── Contextual Project Scope (e.g. DEPARTMENT, ASSIGNED, VENDOR)
  │     ├── Vendor / Client Affiliation IDs
  │     └── Custom Project Permission Grants
  │
  ├── Vendor Membership [0..*] (Outsourcing Facility Scope)
  │     └── Vendor ID & Vendor Roles (Vendor Admin, Vendor Artist)
  │
  └── Client Membership [0..*] (Studio/Client Reviewer Scope)
        └── Client ID & Portal Access Level (Client Admin, Reviewer, Viewer)
```

---

## 3. Standard Roles Matrix

| Role Archetype | Layer | Default Scope | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Platform Admin** | Global | `GLOBAL` | Cross-tenant superuser, system maintenance, audit oversight |
| **Organization Owner** | Organization | `ORGANIZATION` | Full studio administration, billing, tenant lifecycle, security policies |
| **Organization Admin** | Organization | `ORGANIZATION` | User management, roles, groups, project provisioning, workspace setup |
| **VFX Supervisor** | Project / Org | `PROJECT` | Creative approval, cut review, version approval, supervisor publish |
| **Producer / PM** | Project / Org | `PROJECT` | Budgets, schedules, bids, milestone approvals, crew assignments |
| **Lead Artist** | Department | `DEPARTMENT` | Departmental task triage, internal dailies review, asset validation |
| **Senior / Artist** | Assigned | `ASSIGNED` / `OWN` | Execute assigned tasks, publish WIP versions, request review |
| **Vendor Manager** | Vendor | `VENDOR` | Vendor team allocation, vendor bid tracking, vendor batch submission |
| **Vendor Artist** | Vendor | `VENDOR` | Access assigned vendor tasks, submit deliverables to vendor review |
| **Client Producer** | Client | `CLIENT` | Access client milestone cuts, view client versions, final approval |
| **Client Reviewer** | Client | `CLIENT` | Review client-visible media, approve/reject cuts, add review notes |
| **Client Viewer** | Client | `CLIENT` | Read-only view of client-approved versions (no approval mutation) |
| **Auditor** | Organization | `ORGANIZATION` | Read-only access to audit logs, access lineage, security compliance |
| **Viewer** | Project | `PROJECT` | Read-only view across project assets, shots, and sequences |

---

## 4. Multi-Role Union & Evaluation Algorithm

When a user possesses multiple roles within a project context:
1. StudioHub computes the **union** of all permission sets granted by those roles.
2. StudioHub resolves the **most permissive scope** across active roles (e.g. combining `DEPARTMENT` and `PROJECT` resolves to `PROJECT`).
3. If an explicit negative grant or restriction is configured, it takes precedence.

```typescript
const effectivePermissions = union(user.roles.map(r => r.permissions));
const effectiveScope = getEffectiveScope(user.roles.map(r => r.roleName));
```
