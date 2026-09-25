"""
Production permissions — canonical dot-notation codes (e.g. 'project.create') — sees ADR-0033 D3.

These are distinct from Organization RBAC (organization.*) and map to frontend's
`types/auth.ts` Permission union. They are checked via HasPermission with
organization context, but the permission codes are production-specific.
"""


class ProjectPermissions:
    VIEW = "project.view"
    CREATE = "project.create"
    UPDATE = "project.update"
    DELETE = "project.delete"


class SequencePermissions:
    VIEW = "sequence.view"
    CREATE = "sequence.create"
    UPDATE = "sequence.update"
    DELETE = "sequence.delete"


class ShotPermissions:
    VIEW = "shot.view"
    CREATE = "shot.create"
    UPDATE = "shot.update"
    DELETE = "shot.delete"
    APPROVE = "shot.approve"


class AssetPermissions:
    VIEW = "asset.view"
    CREATE = "asset.create"
    UPDATE = "asset.update"
    DELETE = "asset.delete"


class TaskPermissions:
    VIEW = "task.view"
    CREATE = "task.create"
    UPDATE = "task.update"
    DELETE = "task.delete"


class TimelogPermissions:
    VIEW = "timelog.view"
    CREATE = "timelog.create"
    UPDATE = "timelog.update"
    DELETE = "timelog.delete"
    APPROVE = "timelog.approve"


class VersionPermissions:
    VIEW = "version.view"
    CREATE = "version.create"
    UPDATE = "version.update"
    DELETE = "version.delete"
    PUBLISH = "version.publish"


class ReviewPermissions:
    VIEW = "review.view"
    CREATE = "review.create"
    UPDATE = "review.update"
    DELETE = "review.delete"
    APPROVE = "review.approve"


class PlaylistPermissions:
    VIEW = "playlist.view"
    CREATE = "playlist.create"
    UPDATE = "playlist.update"
    DELETE = "playlist.delete"


class MediaPermissions:
    VIEW = "media.view"
    CREATE = "media.create"
    UPDATE = "media.update"
    DELETE = "media.delete"


class WorkflowPermissions:
    VIEW = "workflow.view"
    CREATE = "workflow.create"
    UPDATE = "workflow.update"
    DELETE = "workflow.delete"


class SchedulingPermissions:
    VIEW = "schedule.view"
    CREATE = "schedule.create"
    UPDATE = "schedule.update"
    DELETE = "schedule.delete"


class AnalyticsPermissions:
    VIEW = "analytics.view"


class EditorialTrackPermissions:
    VIEW = "track.view"
    CREATE = "track.create"
    UPDATE = "track.update"
    DELETE = "track.delete"


class ShowPermissions:
    VIEW = "show.view"
    CREATE = "show.create"
    UPDATE = "show.update"
    DELETE = "show.delete"
