from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.team import TeamQuerySet

TeamManager = BaseManager.from_queryset(TeamQuerySet)
