# StudioHub Role-Based Access Control (RBAC) & Permissions

## 1. Security Architecture
StudioHub implements a fine-grained, policy-based RBAC matrix. Permissions are verified on both the frontend (declarative UI gates, routing protection, disabled buttons) and backend API layers.

---

## 2. Default Studio Roles & Capabilities

| Role Name | Scope | Capabilities |
|:---|:---|:---|
| **Studio Admin / Owner** | Organization-Wide | Full administrative access, tenant settings, billing, member invites, role assignments, audit logs. |
| **VFX Supervisor** | Project & Review | Full project creation, shot review approvals, sequence edits, artist assignment, version promotion. |
| **Production Coordinator** | Project & Task | Task scheduling, vendor dispatch, dailies organization, bid management, timeline tracking. |
| **Lead / Senior Artist** | Department / Task | Version publishing, task progress logging, USD layer submission, internal note review. |
| **Outsource Vendor Lead** | Vendor Scoped | Access restricted strictly to assigned task packages, vendor delivery submission, NDA verification. |
| **Client Executive** | Client Portal | Read-only view of approved cuts, screening room playback, client feedback annotations. |

---

## 3. Fine-Grained Permission Matrix

```typescript
export type PermissionKey =
  | 'org:manage'
  | 'project:read' | 'project:create' | 'project:edit' | 'project:delete' | 'project:approve'
  | 'shot:read' | 'shot:create' | 'shot:edit' | 'shot:delete' | 'shot:approve'
  | 'asset:read' | 'asset:create' | 'asset:edit' | 'asset:delete'
  | 'task:read' | 'task:create' | 'task:edit' | 'task:delete' | 'task:assign'
  | 'version:read' | 'version:publish' | 'version:promote' | 'version:delete'
  | 'review:read' | 'review:create' | 'review:attend' | 'review:annotate'
  | 'client:read' | 'client:create' | 'client:edit' | 'client:delete'
  | 'vendor:read' | 'vendor:create' | 'vendor:edit' | 'vendor:delete' | 'vendor:assign'
  | 'people:read' | 'people:create' | 'people:edit' | 'people:delete'
  | 'dept:read' | 'dept:manage'
  | 'team:read' | 'team:manage'
  | 'office:read' | 'office:manage'
  | 'billing:read' | 'billing:admin'
  | 'audit:read'
  | 'settings:manage';
```

---

## 4. UI Permission Gates
- **Declarative Component `<PermissionGate>`**:
  ```tsx
  <PermissionGate permission="project:create" fallback={<Tooltip text="Requires Supervisor permissions" />}>
    <Button onClick={openCreateModal}>New Project</Button>
  </PermissionGate>
  ```
- **Hook Guard `usePermissions()`**:
  ```tsx
  const { can, role } = usePermissions();
  if (!can('shot:approve')) {
    // Disable action button or render read-only indicator
  }
  ```
