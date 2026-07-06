from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.group_role import (
    GroupRoleQuerySet,
)

GroupRoleManager = BaseManager.from_queryset(
    GroupRoleQuerySet,
)
