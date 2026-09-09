# StudioHub Permissions & Role-Based Access Control (RBAC)

## 1. StudioHub RBAC Hierarchy

StudioHub enforces hierarchical, domain-aware permissions across system roles and studio department positions.

```
SYSTEM ROLES
  ├── SUPER_ADMIN (Platform-wide root access)
  ├── ORGANIZATION_ADMIN (Full studio management & billing access)
  ├── STUDIO_SUPERVISOR (Creative approvals, shot signoffs, project assignments)
  ├── LEAD_ARTIST (Task delegation, team review submissions)
  ├── ARTIST (Task updates, publishing, time logging)
  └── CLIENT_REVIEWER (Read-only review & playlist screening room access)
```

---

## 2. DRF Permission Classes

| Permission Class | Path | Behavior |
| :--- | :--- | :--- |
| `IsAuthenticated` | `rest_framework.permissions` | Rejects unauthenticated requests (`401`). |
| `IsTenantMember` | `apps.core.permissions` | Verifies user belongs to `request.organization` (`403`). |
| `IsSupervisorOrAdmin` | `apps.core.permissions` | Restricts approval endpoints (`POST /approve/`) to Leads, Supervisors, and Admins. |
| `IsProjectMember` | `apps.production.permissions` | Ensures user is assigned to project or holds supervisor permissions. |
| `CanPublishVersion` | `apps.pipeline.permissions` | Verifies user has active task or DCC pipeline rights. |

---

## 3. Object-Level Authorization Rule
In accordance with StudioHub Clean Architecture, permission checks must occur in the **Service Layer** and **DRF Permission Classes**, never inside Serializers:
```python
# apps/production/services/shot_service.py
def approve_shot(*, shot: Shot, approved_by: User, notes: str = '') -> Shot:
    if not (approved_by.role in ['SUPERVISOR', 'ADMIN'] or approved_by.is_superuser):
        raise PermissionDenied("Only Supervisors and Administrators can approve shots.")
    
    shot.status = 'Approved'
    shot.save(update_fields=['status', 'updated_at'])
    emit_event('shot.approved', {'shot_id': str(shot.id), 'user_id': str(approved_by.id)})
    return shot
```
