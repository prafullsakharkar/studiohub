from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.group import GroupQuerySet

GroupManager = BaseManager.from_queryset(GroupQuerySet)
