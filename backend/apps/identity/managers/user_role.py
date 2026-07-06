from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.user_role import (
    UserRoleQuerySet,
)

UserRoleManager = BaseManager.from_queryset(
    UserRoleQuerySet,
)
