"""
Deliveries permissions — module:action codes matching frontend RBAC (e.g., 'deliveries:read').

These are distinct from Organization RBAC (organization.*) and map to frontend's
`types/auth.ts` Permission union. They are checked via HasPermission with
organization context, but the permission codes are deliveries-specific.
"""


class DeliveryPermissions:
    VIEW = "deliveries:read"
    CREATE = "deliveries:create"
    UPDATE = "deliveries:update"
    DELETE = "deliveries:delete"
