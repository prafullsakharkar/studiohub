# StudioHub Enterprise Authorization & RBAC Architecture Audit

**Document Status:** Approved Baseline Audit  
**Version:** 2.0.0-ENTERPRISE  
**Target:** Enterprise RBAC, Tenancy Isolation, Scope Resolution & Defense-in-Depth

---

## Table of Contents

1. [Executive Summary & Purpose](#1-executive-summary--purpose)
2. [The 10-Layer Canonical Authorization Hierarchy](#2-the-10-layer-canonical-authorization-hierarchy)
3. [Existing Codebase Architecture Inventory](#3-existing-codebase-architecture-inventory)
4. [Role Hierarchy & Catalog Analysis](#4-role-hierarchy--catalog-analysis)
5. [Scope Engine & Granular Dimension Modeling](#5-scope-engine--granular-dimension-modeling)
6. [UI Authorization Primitives & Component Guards](#6-ui-authorization-primitives--component-guards)
7. [Route Guards & Navigation Security](#7-route-guards--navigation-security)
8. [Multi-Tenancy & Data Isolation Boundaries](#8-multi-tenancy--data-isolation-boundaries)
9. [Mock API vs REST API Parity Audit](#9-mock-api-vs-rest-api-parity-audit)
10. [Root Cause Analysis: "Unable to Open Production Workspace"](#10-root-cause-analysis-unable-to-open-production-workspace)
11. [Gaps, Inconsistencies & Technical Debt Inventory](#11-gaps-inconsistencies--technical-debt-inventory)
12. [Target Architecture & Refactoring Roadmap](#12-target-architecture--refactoring-roadmap)

---

## 1. Executive Summary & Purpose

StudioHub is an enterprise-grade VFX and Animation Production Management Platform. In visual effects pipelines, access control must enforce rigorous non-disclosure agreements (NDAs), project siloing, and vendor isolation. A security leak or unauthorized view of production plates, internal budgets, or client cuts can violate studio contracts and expose confidential intellectual property.

### Objectives of this Audit
1. **Audit Existing Architecture:** Map every layer of authorization in `src/core/permissions`, `src/core/auth`, `src/core/organization`, `src/core/production`, `src/routes`, `src/api`, and `src/mocks`.
2. **Prevent Dual RBAC Fragmentation:** Unify disparate models (legacy simulation store `usePermissionStore` vs active session `AuthProvider` vs `SYSTEM_ROLE_TEMPLATES`).
3. **Formalize Canonical Hierarchy:** Enforce the 10-layer model:
   ```text
   User
    ↓
   Authentication
    ↓
   Platform Role
    ↓
   Organization Membership
    ↓
   Organization Role
    ↓
   Project/Show Membership
    ↓
   Permission
    ↓
   Scope
    ↓
   Resource
    ↓
   Action
    ↓
   ALLOW / DENY
   ```
4. **Identify Gaps & Isolate Root Causes:** Specifically evaluate multi-tenant boundary checks, sensitive field security, client/vendor sandboxing, and the root cause of the "Unable to open production workspace" issue.

---

## 2. The 10-Layer Canonical Authorization Hierarchy

The StudioHub authorization engine follows a strict defense-in-depth model. No action is evaluated in a vacuum; every request passes through sequential gatekeepers:

```text
┌────────────────────────────────────────────────────────┐
│ 1. User Identity & Active Status                       │
│    user != null && user.is_active === true             │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 2. Authentication & Session Integrity                  │
│    Valid JWT Access Token in tokenStorage              │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. Platform Role (Global Superuser Bypass)             │
│    is_superuser === true || role === 'Platform Admin'  │
└───────────────────────────┬────────────────────────────┘
                            │ (If not superuser)
┌───────────────────────────▼────────────────────────────┐
│ 4. Multi-Tenant Organization Membership                │
│    checkUserHasOrgAccess(user, targetOrgId)            │
│    Active membership in target organization            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 5. Organization Role & Org-Level Grants                │
│    Owner / Admin / Member permissions in target tenant │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 6. Project / Show Membership & Production Role         │
│    checkUserHasProjectAccess(user, projectId, orgId)   │
│    Production Admin strictly scoped to member projects │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 7. Fine-Grained Permission Token Resolution            │
│    evaluateUserPermission(user, 'resource.action')     │
│    Direct grants + Role template grants + Wildcards    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 8. Hierarchical Scope Engine Resolution                │
│    GLOBAL -> ORG -> PROJECT -> DEPT -> TEAM ->         │
│    VENDOR -> CLIENT -> ASSIGNED -> OWN                 │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 9. Resource Boundary & Entity Ownership                │
│    evaluateResourceAction & evaluateEntityVisibility   │
│    Vendor/Client isolation, Dept/Team membership       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 10. Specific Action Authorization Decision             │
│    ALLOW (Execute Mutation/View) / DENY (403 Forbidden)│
└────────────────────────────────────────────────────────┘
```

### Detailed Layer Breakdown

| Layer | Responsibility | Key Files | Failure State |
| :--- | :--- | :--- | :--- |
| **1. User Identity** | Verifies user exists, account is active (`is_active !== false`). | `src/types/auth.ts`, `src/core/auth/useCurrentUser.ts` | Immediate `DENY` |
| **2. Authentication** | Validates session token in local/in-memory storage. | `src/core/auth/tokenStorage.ts`, `src/routes/AuthenticatedRoute.tsx` | Redirect to `/login` |
| **3. Platform Role** | Identifies global system superusers (`is_superuser`, `Platform Admin`). Bypass for tenant routing. | `src/core/permissions/rbac.ts` (`isPlatformAdmin`) | Evaluates tenant layers |
| **4. Organization Membership** | Multi-tenant isolation: ensures user belongs to requested `organizationId`. Prevents cross-tenant leaks. | `src/core/permissions/rbac.ts` (`checkUserHasOrgAccess`), `OrganizationRoute.tsx` | Redirect to `/unauthorized` |
| **5. Organization Role** | Determines tenant authority: `Organization Owner`, `Organization Admin`, `Organization Manager`. | `src/core/permissions/systemRoles.ts`, `OrganizationMembershipRoute.tsx` | `DENY` / 403 Forbidden |
| **6. Project/Show Membership** | Enforces project sandboxing. Users only see assigned projects/shows unless Org Owner. | `src/core/permissions/rbac.ts` (`checkUserHasProjectAccess`), `ProjectRoute.tsx` | Renders `NoProjectAccessPage` |
| **7. Permission Token** | Checks canonical permission (e.g. `shot.create`, `task.update`, `review.approve`). | `src/core/permissions/rbac.ts` (`evaluateUserPermission`) | `DENY` / Hide element |
| **8. Scope Resolution** | Normalizes scope dimension (`GLOBAL`, `ORGANIZATION`, `PROJECT`, `DEPARTMENT`, `TEAM`, `ASSIGNED`, `OWN`). | `src/core/permissions/scopeEngine.ts` (`normalizeScope`, `getEffectiveScope`) | `DENY` if entity out of scope |
| **9. Resource Boundary** | Entity-level rules: vendor company match, client assignment, sensitive field masks. | `src/core/permissions/resourceAuthorizationEngine.ts`, `externalAccessEngine.ts` | Filter/Mask data |
| **10. Final Decision** | Binary `ALLOW` / `DENY` decision with audit logging. | `src/core/permissions/apiAuthorization.ts` | 200 OK / 403 Forbidden |

---

## 3. Existing Codebase Architecture Inventory

The audit reveals a rich set of specialized authorization engines operating in `src/core/permissions`:

### 3.1 Central RBAC Evaluator (`src/core/permissions/rbac.ts`)
- **Core Function:** `evaluateUserPermission(user, permission, context)`
- **Capabilities:**
  - Evaluates direct `user.permissions`
  - Resolves active organization membership (`getUserMembership`)
  - Resolves project-level membership (`getUserProjectMembership`)
  - Evaluates role template permissions from `SYSTEM_ROLE_TEMPLATES`
  - Supports wildcard tokens (`*`, `project.*`, `shot.*`, `people.*`)
  - Translates legacy colon permissions via `LEGACY_TO_CANONICAL_MAP` (`projects:read` -> `project.view`)
  - Cross-tenant validation: rejects evaluations when `context.organizationId` mismatches user memberships.

### 3.2 Scope Resolution Engine (`src/core/permissions/scopeEngine.ts`)
- **Core Functions:** `normalizeScope`, `getDefaultScopeForRole`, `getEffectiveScope`, `isEntityInScope`
- **Capabilities:**
  - Maps 9 discrete scopes: `GLOBAL`, `ORGANIZATION`, `PROJECT`, `SHOW`, `DEPARTMENT`, `TEAM`, `VENDOR_PROJECT`, `CLIENT_PROJECT`, `ASSIGNED`, `OWN`.
  - Determines role scope inheritance hierarchy.
  - Determines if an individual entity (e.g., Shot, Task, Asset) falls within a user's department, team, vendor, or personal assignment.

### 3.3 External Access & Isolation Engine (`src/core/permissions/externalAccessEngine.ts`)
- **Core Functions:** `evaluateEntityVisibility`, `isUserAssignedToProject`, `filterEntitiesForExternalUser`, `evaluateExternalAccess`
- **Capabilities:**
  - Segregates internal studio staff from external vendors and clients.
  - Enforces vendor sandboxing: Vendor users can **only** see assets, shots, and tasks assigned to their specific vendor company (`vendor_id`).
  - Enforces client sandboxing: Client users can **only** see approved versions and review playlists explicitly marked for client review.

### 3.4 Field-Level Security Engine (`src/core/permissions/fieldPermissionEngine.ts`)
- **Core Functions:** `canAccessField`, `maskSensitiveFields`, `filterSensitiveEntityFields`
- **Capabilities:**
  - Masks sensitive financial, HR, and contract fields:
    - `project.budget` -> `[RESTRICTED_BUDGET]`
    - `project.billing` -> `[RESTRICTED_BILLING]`
    - `task.cost` & `task.internal_rate` -> `null`
    - `people.compensation` -> `[CONFIDENTIAL]`
    - `people.day_rate` & `people.overtime_rate` -> `null`
    - `vendor.hourly_rate` & `vendor.contract_value` -> `null`
    - `client.contract_value` -> `null`

### 3.5 Bulk Mutation Authorization Engine (`src/core/permissions/bulkAuthorizationEngine.ts`)
- **Core Functions:** `evaluateBulkAction`, `filterAuthorizedBulkEntities`
- **Capabilities:**
  - Evaluates batch operations (`bulk_create`, `bulk_update`, `bulk_archive`, `bulk_restore`, `bulk_delete`).
  - Validates every target entity individually. If a user attempts to bulk-update 50 shots and 2 belong to another project or unassigned vendor, the engine either partitions the batch or denies unauthorized targets.

### 3.6 Workflow State Transition Engine (`src/core/permissions/workflowStateEngine.ts`)
- **Core Functions:** `canTransitionWorkflowState`, `getAllowedNextStates`
- **Capabilities:**
  - Validates pipeline status transitions against user roles:
    - Only Leads, Supervisors, and Admins can transition shots/tasks to `Approved` or `Omitted`.
    - Artists can transition tasks from `Assigned` -> `In Progress` -> `Pending Review`.
    - Client Reviewers can transition items to `Client Approved` or `Changes Requested`.

### 3.7 API & Backend Simulation Guard (`src/core/permissions/apiAuthorization.ts`)
- **Core Function:** `authorizeApiRequest(user, req)`
- **Capabilities:**
  - Pre-flight authorization interceptor before any repository mutation.
  - Standardizes error responses: `{ ok: false, status: 403, code: 'FORBIDDEN', requiredPermission }`.

### 3.8 Route Permission Registry (`src/core/permissions/routePermissionsRegistry.ts`)
- **Core Functions:** `getRoutePermissionMetadata`, `evaluateRouteAccess`, `isProjectTabAllowed`
- **Capabilities:**
  - Maps 70+ routes and 15 project workspace tabs to required page permissions, resource permissions, and membership requirements.

---

## 4. Role Hierarchy & Catalog Analysis

StudioHub defines 36 system roles in `src/core/permissions/systemRoles.ts` organized into 6 functional tiers:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Platform & Executive Tier                                │
│    - Platform Admin (Global Superuser)                      │
│    - Organization Owner (Tenant Superuser)                  │
├─────────────────────────────────────────────────────────────┤
│ 2. Studio Management Tier                                   │
│    - Organization Admin                                     │
│    - Organization Manager                                   │
│    - Department Manager                                     │
│    - Team Manager                                           │
├─────────────────────────────────────────────────────────────┤
│ 3. Production Leadership Tier                               │
│    - Production Admin (Project Scoped)                      │
│    - Executive Producer                                     │
│    - Producer                                               │
│    - Production Manager                                     │
│    - Production Coordinator                                 │
│    - Production Assistant                                   │
├─────────────────────────────────────────────────────────────┤
│ 4. Creative & Pipeline Supervision Tier                     │
│    - VFX Supervisor                                         │
│    - CG Supervisor                                          │
│    - Animation Supervisor                                   │
│    - Sequence Supervisor                                    │
│    - Shot Supervisor                                        │
│    - Asset Supervisor                                       │
│    - Pipeline Supervisor                                    │
│    - Pipeline TD & Core Tech TD                             │
│    - Technical Director                                     │
├─────────────────────────────────────────────────────────────┤
│ 5. Craft Execution Tier                                     │
│    - Lead Artist                                            │
│    - Senior Artist                                          │
│    - Artist                                                 │
│    - 15 Specialized Craft Roles (Modeler, Lighter, Comp...) │
├─────────────────────────────────────────────────────────────┤
│ 6. External Partner Tier                                    │
│    - Vendor Admin, Vendor Manager, Vendor Artist            │
│    - Client Admin, Client Producer, Client Reviewer/Viewer  │
└─────────────────────────────────────────────────────────────┘
```

### Critical Role Scoping Distinctions
1. **Platform Admin (`platform_admin`)**: Scope is `GLOBAL`. Unrestricted access across all organizations, projects, and system settings.
2. **Organization Owner (`org_owner`)**: Scope is `ORGANIZATION`. Complete authority over their organization, billing, crews, and all projects within their tenant.
3. **Organization Admin (`org_admin`)**: Scope is `ORGANIZATION`. Manages crew rosters, departments, and studio data, but cannot modify tenant billing or destroy the organization.
4. **Production Admin (`production_admin`)**: Scope is **strictly `PROJECT`**. A Production Admin on Project A has **zero** administrative rights on Project B unless explicitly granted membership on Project B.
5. **Vendor Roles (`vendor_*`)**: Scope is `VENDOR_PROJECT` or `VENDOR_PROJECT_ASSIGNED`. Strictly sandboxed to work assigned to their vendor company.
6. **Client Roles (`client_*`)**: Scope is `CLIENT_PROJECT`. Restricted to client-facing milestones, playlists, and review approvals.

---

## 5. Scope Engine & Granular Dimension Modeling

The scope dimension determines **which entities** a user can interact with once the permission is confirmed.

```text
GLOBAL
  │  (All tenants, projects, and entities)
  ▼
ORGANIZATION
  │  (All projects and entities within the tenant)
  ▼
PROJECT / SHOW
  │  (All entities inside the specific project/show)
  ▼
DEPARTMENT
  │  (Entities matching user's department, e.g., FX, Lighting)
  ▼
TEAM
  │  (Entities matching user's team unit)
  ▼
ASSIGNED
  │  (Only entities explicitly assigned to this user)
  ▼
OWN
     (Only records created by the user, e.g., personal notes, timelogs)
```

### External Scope Branches
- `VENDOR_PROJECT`: Vendor management seeing all entities assigned to their vendor company on that project.
- `VENDOR_PROJECT_ASSIGNED`: Vendor individual artist seeing only their assigned tasks.
- `CLIENT_PROJECT`: Client seeing published client turnovers and review playlists for that project.

---

## 6. UI Authorization Primitives & Component Guards

StudioHub provides several UI authorization primitives across the codebase.

### 6.1 `PermissionGate` (`src/core/permissions/PermissionComponents.tsx`)
Conditionally renders child components based on user permissions:
```tsx
<PermissionGate 
  permission="shot.create" 
  context={{ projectId: 'proj-001' }}
  fallback={<DisabledPlaceholder />}
>
  <CreateShotModalButton />
</PermissionGate>
```

### 6.2 `PermissionButton` (`src/core/permissions/PermissionComponents.tsx`)
Standard UI button that integrates permission checks:
- Can either hide (`hideWhenUnauthorized`) or disable (`disableWhenUnauthorized`) with an informative tooltip explaining the required permission.

### 6.3 `PermissionMenuItem` (`src/core/permissions/PermissionComponents.tsx`)
Menu action items in dropdowns and contextual menus that hide or show lock icons when permissions are absent.

### 6.4 `Can` & `HasRole` (`src/core/permissions/Can.tsx`, `HasRole.tsx`)
Declarative wrappers around `useAuth()`:
```tsx
<Can perform="asset.delete" on={activeAsset}>
  <DeleteButton />
</Can>
<HasRole role="Organization Admin">
  <BillingSettingsPanel />
</HasRole>
```

### 6.5 `PermissionControl` (`src/core/permissions/PermissionControl.tsx`)
A unified wrapper component supporting `permission`, `entityType`, `action`, `requiredRoles`, and fallback behavior.

---

## 7. Route Guards & Navigation Security

StudioHub employs a multi-tiered route guarding pipeline defined in `src/routes/`:

```text
Request URL (e.g. /projects/proj-001/shots)
  │
  ├── 1. AuthenticatedRoute
  │      Validates user authentication session. If null -> /login
  │
  ├── 2. OrganizationRoute
  │      Validates active organization context. If cross-tenant -> /unauthorized
  │
  ├── 3. RoutePermissionGuard
  │      Validates URL against routePermissionsRegistry.ts
  │      If page/resource permission denied -> /forbidden
  │
  ├── 4. ProjectRoute
  │      Validates project membership for /projects/:id and /shows/:id
  │      If unassigned -> renders NoProjectAccessPage
  │
  └── 5. PermissionRoute
         Inline route wrapper for specific permission requirements
```

### Route Guard Summary Table

| Guard Component | Evaluation Target | Success Action | Failure Action |
| :--- | :--- | :--- | :--- |
| `AuthenticatedRoute` | `tokenStorage.hasValidSession()` & `isAuthenticated` | Render children | `<Navigate to="/login" />` |
| `OrganizationRoute` | `checkUserHasOrgAccess(user, currentOrg.id)` | Render children | `<Navigate to="/unauthorized" />` |
| `ProjectRoute` | `checkUserHasProjectAccess(user, projectId, orgId)` | Render children | `<NoProjectAccessPage />` |
| `RoutePermissionGuard` | `evaluateRouteAccess(user, pathname, context)` | Render children | `<Navigate to="/forbidden" />` |
| `PermissionRoute` | `evaluateUserPermission(user, permissions)` | Render children | `<Navigate to="/forbidden" />` |
| `OrganizationMembershipRoute` | `checkUserHasRole(user, requiredRoles, orgId)` | Render children | `<Navigate to="/forbidden" />` |

---

## 8. Multi-Tenancy & Data Isolation Boundaries

StudioHub enforces data isolation at 4 critical boundaries:

### 8.1 Organization Tenancy Isolation
- Every core entity contains `organization_id`.
- The repository layer (`BaseMockAdapter`, REST API) filters queries by `currentOrganization.id`.
- Cross-tenant requests produce an immediate 403 Forbidden.

### 8.2 Project Scoping Isolation
- Users cannot browse, read, or modify projects unless they possess:
  1. Global superuser status (`is_superuser`, `Platform Admin`), OR
  2. `Organization Owner` role for the parent tenant, OR
  3. An active record in `user.project_memberships` for that project.
- Production Admins cannot access projects outside their membership list.

### 8.3 External Partner Sandboxing
- External users (`membership_type: 'VENDOR'` or `'CLIENT'`) have direct URL restrictions enforced in `routePermissionsRegistry.ts`:
  - Blocked from `/settings`, `/organization`, `/people`, `/departments`, `/teams`, `/offices`, `/clients`, `/vendors`, `/audit`.
  - In project workspaces, vendor-banned tabs (`pipeline`, `resources`, `workflow`) and client-banned tabs (`tasks`, `notes`, `schedule`, `resources`, `pipeline`, `workflow`, `timelogs`, `publishing`, `activity`) are strictly omitted.

### 8.4 Sensitive Field Masking
- Handled via `fieldPermissionEngine.ts`.
- Non-executive users receive masked values for project budgets, task labor rates, employee salaries, and contractor fees.

---

## 9. Mock API vs REST API Parity Audit

The application supports dual API modes configured via `VITE_API_MODE`:
- `mock`: In-memory repository adapters with localStorage persistence.
- `rest`: Real Django REST Framework / backend proxy calls.

### Repository Architecture Parity
All consumer code communicates with abstract repository interfaces (`IProjectRepository`, `ITaskRepository`, `IAssetRepository`, `IShotRepository`, `IOrganizationRepository`, `IAuthRepository`) via dynamic proxies in `src/api/repositories/index.ts`.

### Authorization Parity Analysis

| Capability | Mock Repository (`src/api/repositories/adapters/mock`) | REST API (`src/api/repositories/adapters/rest`) | Status |
| :--- | :--- | :--- | :--- |
| **Authentication** | Validates credentials against `mockUsers` and issues simulated JWTs. | Sends credentials to `/api/v1/auth/token/`. | **Parity Achieved** |
| **Org Scoping** | `BaseMockAdapter` filters items by `item.organization_id === orgId`. | Backend DRF queries filter by tenant header. | **Parity Achieved** |
| **Pre-flight Auth** | `authorizeApiRequest()` validates permissions before mutation. | Server DRF permission classes (`IsAuthenticated`, `HasProjectPermission`). | **Parity Achieved** |
| **Field Masking** | `maskSensitiveFields()` strips fields prior to returning payloads. | DRF Serializers omit sensitive fields based on user role. | **Parity Achieved** |
| **Bulk Auth** | `evaluateBulkAction()` validates every record in batch. | DRF bulk endpoints validate permissions per item. | **Parity Achieved** |

---

## 10. Root Cause Analysis: "Unable to Open Production Workspace"

The audit investigated why users encounter issues opening the Production Workspace. Four specific architectural issues contribute to workspace loading failures:

### 10.1 Root Cause A: Route Param Extraction vs Context Disconnect in `RoutePermissionGuard`
In `src/routes/RoutePermissionGuard.tsx`:
```tsx
const result = evaluateRouteAccess(user, location.pathname, {
  organizationId: currentOrganization?.id,
  // NOTICE: projectId is NOT extracted or passed here!
});
```
When navigating to `/projects/proj-001`, `location.pathname` matches the route `/projects/:id` in `routePermissionsRegistry.ts`:
```ts
'/projects/:id': {
  path: '/projects/:id',
  pagePermission: 'page.project.overview',
  permissions: ['project.view'],
  requiresOrgMembership: true,
  requiresProjectMembership: true,
}
```
Because `projectId` was omitted from the evaluation context in `RoutePermissionGuard`, if `requiresProjectMembership` was checked without the extracted `projectId`, the evaluation logic had to either bypass the check or fail.

### 10.2 Root Cause B: Tenant ID Mismatch on Direct Project Navigation
In `src/routes/ProjectRoute.tsx`:
```tsx
const rawProjectParam = params.projectId || params.id || params.showId;
const showMatch = rawProjectParam ? mockShows.find((s) => s.id === rawProjectParam) : undefined;
const projectId = showMatch ? showMatch.project_id : rawProjectParam;
const orgId = params.organizationId || currentOrganization?.id;

// Check organization access
if (orgId && !checkUserHasOrgAccess(user, orgId)) {
  return <Navigate to="/unauthorized" replace />;
}

// Check project access
if (projectId) {
  const hasProjectAccess = checkUserHasProjectAccess(user, projectId, orgId);
  if (!hasProjectAccess) {
    return <NoProjectAccessPage projectId={projectId} />;
  }
}
```
**The Failure Scenario:**
1. A user is currently viewing Organization A (`org-apex-01`).
2. The user has valid membership in Project 3 (`proj-003`), which belongs to Organization B (`org-vanguard-02`).
3. The user opens the direct link `/projects/proj-003`.
4. `params.organizationId` is `undefined`, so `orgId` defaults to `currentOrganization.id` (`org-apex-01`).
5. `checkUserHasProjectAccess(user, 'proj-003', 'org-apex-01')` checks `isUserAssignedToProject(user, 'proj-003', 'org-apex-01')`.
6. `isUserAssignedToProject` checks:
   ```ts
   const projMem = getUserProjectMembership(user, projectId, organizationId);
   ```
   Because `projMem.organization_id` is `org-vanguard-02`, passing `org-apex-01` causes `getUserProjectMembership` to find **no match**!
7. The user is redirected to `NoProjectAccessPage` or `/unauthorized`, even though they are an active member of `proj-003`!

### 10.3 Root Cause C: Missing `ProjectRoute` Wrapping on Sub-Entity Production Routes
In `src/routes/AppRoutes.tsx`:
- The `/projects/:id` workspace routes were wrapped in `<Route element={<ProjectRoute />}>`.
- However, direct routes such as `/projects/:projectId/shots/:shotId` and `/shots/:shotId` were mounted **outside** `ProjectRoute`.
- When navigating directly between shots or assets, project membership checks were inconsistent.

### 10.4 Root Cause D: Stale Context in `useProductionStore`
`useProductionStore` persists `activeProjectId` in localStorage under `studiohub_production_context_v2`. If the stored ID belongs to a project from a previous organization, switching organizations without an automatic project synchronization caused `ProjectWorkspace` to attempt loading a project that did not exist in the active tenant.

---

## 11. Gaps, Inconsistencies & Technical Debt Inventory

| Category | Finding / Inconsistency | Risk | Remediation Required |
| :--- | :--- | :--- | :--- |
| **Simulation vs Reality** | `usePermissionStore` stores simulation state (`currentRoleId`, `customOverrides`) for demo switching, while `AuthProvider` maintains real session auth. In some components (`PermissionControl.tsx`), `usePermissions()` (simulation) was queried instead of `AuthProvider.can()`. | High | Isolate simulation strictly to the Admin Demo Switcher; ensure all production enforcement uses `AuthProvider` / `rbac.ts`. |
| **Dual Role Systems** | `ENTERPRISE_ROLES` (6 coarse roles in `enterprisePermissions.ts`) vs `SYSTEM_ROLE_TEMPLATES` (36 granular roles in `systemRoles.ts`). | Medium | Unify role definitions; ensure `ENTERPRISE_ROLES` maps directly to `SYSTEM_ROLE_TEMPLATES`. |
| **Legacy Permission Tokens** | Some components still query legacy strings (`projects:read`, `shots:create`) instead of canonical dot notation (`project.view`, `shot.create`). | Low | The `LEGACY_TO_CANONICAL_MAP` handles this at runtime, but all callers should converge to canonical dot notation. |
| **Route Param Extraction** | `RoutePermissionGuard` does not extract route params (`:id`, `:projectId`, `:organizationId`) before calling `evaluateRouteAccess`. | High | Enhance route matcher to extract path parameters and pass them into the evaluation context. |
| **Cross-Tenant Project Linking** | Direct navigation to `/projects/:id` fails when `currentOrganization` does not match the project's parent tenant. | High | In `ProjectRoute` and `ProjectWorkspacePage`, look up the project's owning organization and automatically switch active org context if user has membership. |

---

## 12. Target Architecture & Refactoring Roadmap

To ensure zero regressions and achieve full enterprise compliance:

### 12.1 Canonical Unified Authorization Hook
Refactor all components toward a single authoritative hook:
```typescript
const { can, hasRole, hasOrgAccess, user } = useAuth();
// OR
const { can, isAllowed } = usePermissionEvaluator();

const canCreateShot = can({
  permission: 'shot.create',
  projectId: activeProjectId,
  organizationId: activeOrgId,
});
```

### 12.2 Enhanced `ProjectRoute` with Auto-Tenant Resolution
Update `ProjectRoute.tsx` so that when a project ID is supplied without an organization ID in the URL:
1. Identify the project's owning organization from project metadata or user memberships.
2. Verify user has access to that organization.
3. Automatically align `currentOrganization` with the project's tenant.
4. Verify user has project membership.

### 12.3 Parameterized Route Guarding
Update `RoutePermissionGuard.tsx` to automatically extract path parameters (`projectId`, `organizationId`, `shotId`, `assetId`) from the current route regex and inject them into `evaluateRouteAccess`.

### 12.4 Complete Access Matrix
Document every role, permission, and scope in `docs/access-control/ACCESS-MATRIX.md`.

---
*End of RBAC Architecture Audit.*
