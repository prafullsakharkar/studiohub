"""
Scheduling permissions — module:action codes matching frontend RBAC (e.g., 'scheduling:read').

These are distinct from Organization RBAC (organization.*) and map to frontend's
`types/auth.ts` Permission union. They are checked via HasPermission with
organization context, but the permission codes are scheduling-specific.
"""


class SchedulingPermissions:
    VIEW = "schedule.view"
    # Pay rates and e-mail addresses of resources (D-21); the full roles hold it, others do not.
    VIEW_RATES = "schedule.view_rates"
    CREATE = "schedule.create"
    UPDATE = "schedule.update"
    DELETE = "schedule.delete"
