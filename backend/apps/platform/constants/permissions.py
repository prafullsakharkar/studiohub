"""
Platform permissions — module:action codes matching frontend RBAC.

Mapped to the frontend Permission union (e.g. ``reports:read``,
``notifications:read``). Checked via HasPermission with organization
context.
"""


class PlatformPermissions:
    REPORTS_VIEW = "reports:read"
    REPORTS_CREATE = "reports:create"
    NOTIFICATIONS_VIEW = "notifications:read"
    NOTIFICATIONS_UPDATE = "notifications:update"
