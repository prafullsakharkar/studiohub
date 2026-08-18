from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.group_member import GroupMemberQuerySet

GroupMemberManager = BaseManager.from_queryset(GroupMemberQuerySet)
