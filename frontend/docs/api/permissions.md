# StudioHub Permissions & Role-Based Access Control (RBAC)

## 1. StudioHub RBAC Hierarchy

StudioHub enforces hierarchical, domain-aware permissions across platform and production roles. The organization tenant tier was removed; directory roles are platform-scoped and production roles are project-scoped.

```
SYSTEM ROLES (org-free)
  ├── PLATFORM_ADMIN (Platform-wide root access; full catalog)
  ├── PRODUCTION_ADMIN (Full production CRUD + approvals across projects)
  ├── VFX_SUPERVISOR (Creative approvals, shot signoffs, project assignments)
  ├── LEAD_ARTIST (Task delegation, team review submissions)
  ├── ARTIST (Task updates, publishing, time logging)
  └── CLIENT_REVIEWER (Read-only review & playlist screening room access)
```

---

## 2. DRF Permission Classes

| Permission Class | Path | Behavior |
| :--- | :--- | :--- |
| `IsAuthenticated` | `rest_framework.permissions` | Rejects unauthenticated requests (`401`). |
| `IsProjectMember` | `apps.production.permissions` | Ensures user is a member of the project (or platform admin) (`403`). |
| `IsSupervisorOrAdmin` | `apps.core.permissions` | Restricts approval endpoints (`POST /approve/`) to Leads, Supervisors, and Admins. |
| `CanPublishVersion` | `apps.pipeline.permissions` | Verifies user has active task or DCC pipeline rights. |

There is no tenant permission class: `X-Organization-Id` was removed and no
organization membership check exists. Production data isolation is enforced by
project membership; directory data is platform-wide.

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
---

## 4. Access Model (frontend ↔ backend, org-free)

- No organization selection exists: no org switcher, no org-scoped fetches, no
  `organization_id` in request payloads or query strings.
- Production endpoints (`/api/v1/projects/…`, shots, assets, tasks, versions,
  reviews, deliveries) are scoped by **project membership**: non-members get
  `403` and the frontend route registry redirects them to `/forbidden` (no
  data leak).
- Directory endpoints (`/api/v1/clients/`, `/vendors/`, `/people/`,
  `/departments/`, `/teams/`, `/offices/`) are platform-wide; reads are gated
  by the viewer's directory-view permissions.
- `GET /api/v1/info/version/` is public and returns `{version, environment}`
  for header rendering — never a hardcoded string.
