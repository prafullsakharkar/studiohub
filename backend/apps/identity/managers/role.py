from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.role import (
    RoleQuerySet,
)

RoleManager = BaseManager.from_queryset(
    RoleQuerySet,
)
