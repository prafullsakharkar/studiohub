from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.group_role import GroupRoleQuerySet

GroupRoleManager = BaseManager.from_queryset(GroupRoleQuerySet)
