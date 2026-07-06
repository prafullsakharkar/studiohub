from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.group_member import (
    GroupMemberQuerySet,
)

GroupMemberManager = BaseManager.from_queryset(
    GroupMemberQuerySet,
)
