# Scope Hierarchy & Evaluation Engine

StudioHub defines a 9-tier hierarchical scope model to precisely enforce access boundaries from studio-wide infrastructure down to single artist task allocations.

---

## 1. The 9 Canonical Scopes

| Scope | Rank (Permissiveness) | Target Domain | Visibility Boundary |
| :--- | :--- | :--- | :--- |
| `GLOBAL` | 9 (Highest) | Entire Platform | All tenants, all projects, system configuration |
| `ORGANIZATION` | 8 | Studio Tenant | All projects and resources within owning studio |
| `PROJECT` | 7 | Project / Show | All sequences, shots, assets within the assigned project |
| `DEPARTMENT` | 6 | Discipline Dept | Entities tagged with user's active department (e.g. FX, Comp) |
| `TEAM` | 5 | Squad / Unit | Entities assigned to the specific task squad |
| `VENDOR` | 4 | Vendor Facility | Strictly entities allocated to the user's `vendor_id` |
| `CLIENT` | 3 | Client Studio | Strictly entities marked `is_client_visible: true` for `client_id` |
| `ASSIGNED` | 2 | Artist Assigned | Entities where `assignee_id === user.id` |
| `OWN` | 1 (Lowest) | Self-Created | Entities where `created_by === user.id` |

---

## 2. Evaluation Logic (`isEntityInScope`)

```typescript
export function isEntityInScope(
  user: User,
  entity: any,
  resourceType: string,
  scope: ScopeLevel = 'PROJECT',
  context?: AccessContext
): boolean {
  if (user.is_superuser || scope === 'GLOBAL') return true;
  if (scope === 'ORGANIZATION') return entity.organization_id === user.organization_id;
  if (scope === 'PROJECT') return entity.project_id === context?.projectId;
  if (scope === 'DEPARTMENT') return entity.department === user.department;
  if (scope === 'VENDOR') return entity.vendor_id === user.vendor_id;
  if (scope === 'CLIENT') return entity.is_client_visible === true && entity.client_id === user.client_id;
  if (scope === 'ASSIGNED') return entity.assignee_id === user.id || entity.assigned_artist_id === user.id;
  if (scope === 'OWN') return entity.created_by === user.id || entity.user_id === user.id;
  return false;
}
```

---

## 3. Scope Promotion & Union Rules

When resolving multiple roles:
`max(scope1, scope2, ...)` determines the active boundary:
- `ASSIGNED` + `DEPARTMENT` ➔ `DEPARTMENT`
- `DEPARTMENT` + `PROJECT` ➔ `PROJECT`
- `VENDOR` + `PROJECT` ➔ `PROJECT` (for dual-hat production liaisons)
