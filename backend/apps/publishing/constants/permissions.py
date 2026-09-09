"""
Publishing permissions — module:action codes matching frontend RBAC (e.g., 'publishing:read').

These are distinct from Organization RBAC (organization.*) and map to frontend's
`types/auth.ts` Permission union. They are checked via HasPermission with
organization context, but the permission codes are publishing-specific.
"""


class PublishPermissions:
    VIEW = "publishing:read"
    CREATE = "publishing:create"
    UPDATE = "publishing:update"
    DELETE = "publishing:delete"
