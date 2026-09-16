"""
Production admin module.
"""

from .asset import AssetAdmin
from .automation import AutomationAuditLogAdmin, AutomationRuleAdmin
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
from .task import TaskAdmin
from .timelog import TimelogAdmin
from .version import VersionAdmin
from .workflow import WorkflowAdmin

__all__ = [
    "AutomationAuditLogAdmin",
    "AutomationRuleAdmin",
    "ProjectAdmin",
    "SequenceAdmin",
    "ShotAdmin",
    "AssetAdmin",
    "TaskAdmin",
    "TimelogAdmin",
    "VersionAdmin",
    "ReviewAdmin",
    "MediaAdmin",
    "PlaylistAdmin",
    "WorkflowAdmin",
    "ProjectMembershipAdmin",
    "EditorialCutAdmin",
    "ProjectNoteAdmin",
]
