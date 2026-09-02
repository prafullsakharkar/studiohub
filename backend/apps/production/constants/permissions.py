"""
Production permissions — module:action codes matching frontend RBAC (e.g., 'projects:create').

These are distinct from Organization RBAC (organization.*) and map to frontend's
`types/auth.ts` Permission union. They are checked via HasPermission with
organization context, but the permission codes are production-specific.
"""


class ProjectPermissions:
    VIEW = "projects:read"
    CREATE = "projects:create"
    UPDATE = "projects:update"
    DELETE = "projects:delete"


class SequencePermissions:
    VIEW = "sequences:read"
    CREATE = "sequences:create"
    UPDATE = "sequences:update"
    DELETE = "sequences:delete"


class ShotPermissions:
    VIEW = "shots:read"
    CREATE = "shots:create"
    UPDATE = "shots:update"
    DELETE = "shots:delete"
    APPROVE = "shots:approve"


class AssetPermissions:
    VIEW = "assets:read"
    CREATE = "assets:create"
    UPDATE = "assets:update"
    DELETE = "assets:delete"


class TaskPermissions:
    VIEW = "tasks:read"
    CREATE = "tasks:create"
    UPDATE = "tasks:update"
    DELETE = "tasks:delete"


class TimelogPermissions:
    VIEW = "timelogs:read"
    CREATE = "timelogs:create"
    UPDATE = "timelogs:update"
    DELETE = "timelogs:delete"
    APPROVE = "timelogs:approve"


class VersionPermissions:
    VIEW = "versions:read"
    CREATE = "versions:create"
    UPDATE = "versions:update"
    DELETE = "versions:delete"
    PUBLISH = "versions:publish"


class ReviewPermissions:
    VIEW = "reviews:read"
    CREATE = "reviews:create"
    UPDATE = "reviews:update"
    DELETE = "reviews:delete"
    APPROVE = "reviews:approve"


class PlaylistPermissions:
    VIEW = "playlists:read"
    CREATE = "playlists:create"
    UPDATE = "playlists:update"
    DELETE = "playlists:delete"


class MediaPermissions:
    VIEW = "media:read"
    CREATE = "media:create"
    UPDATE = "media:update"
    DELETE = "media:delete"


class WorkflowPermissions:
    VIEW = "workflows:read"
    CREATE = "workflows:create"
    UPDATE = "workflows:update"
    DELETE = "workflows:delete"


class SchedulingPermissions:
    VIEW = "scheduling:read"
    CREATE = "scheduling:create"
    UPDATE = "scheduling:update"
    DELETE = "scheduling:delete"


class AnalyticsPermissions:
    VIEW = "analytics:read"
