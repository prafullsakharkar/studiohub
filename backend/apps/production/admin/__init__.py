"""
Production admin module.
"""

from .asset import AssetAdmin
from .automation import AutomationAuditLogAdmin, AutomationRuleAdmin
from .episode import EpisodeAdmin
from .media import MediaAdmin
from .playlist import PlaylistAdmin
from .project import ProjectAdmin
from .project_scoped import (
    EditorialCutAdmin,
    EditorialTrackAdmin,
    ProjectMembershipAdmin,
    ProjectNoteAdmin,
    ShowAdmin,
)
from .review import ReviewAdmin
from .sequence import SequenceAdmin
from .shot import ShotAdmin
from .shot_asset import ShotAssetAdmin
from .status_history import StatusHistoryAdmin
from .task import TaskAdmin
from .task_template import TaskTemplateAdmin
from .timelog import TimelogAdmin
from .version import VersionAdmin
from .workflow import WorkflowAdmin

__all__ = [
    "AutomationAuditLogAdmin",
    "AutomationRuleAdmin",
    "EpisodeAdmin",
    "ProjectAdmin",
    "SequenceAdmin",
    "ShotAdmin",
    "ShotAssetAdmin",
    "StatusHistoryAdmin",
    "AssetAdmin",
    "TaskAdmin",
    "TaskTemplateAdmin",
    "TimelogAdmin",
    "VersionAdmin",
    "ReviewAdmin",
    "MediaAdmin",
    "PlaylistAdmin",
    "WorkflowAdmin",
    "ProjectMembershipAdmin",
    "EditorialCutAdmin",
    "EditorialTrackAdmin",
    "ShowAdmin",
    "ProjectNoteAdmin",
]
