"""
Scheduling permissions — module:action codes matching frontend RBAC (e.g., 'scheduling:read').

These are distinct from Organization RBAC (organization.*) and map to frontend's
`types/auth.ts` Permission union. They are checked via HasPermission with
organization context, but the permission codes are scheduling-specific.
"""


class SchedulingPermissions:
    VIEW = "scheduling:read"
    CREATE = "scheduling:create"
    UPDATE = "scheduling:update"
    DELETE = "scheduling:delete"
