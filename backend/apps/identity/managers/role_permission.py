from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.role_permission import (
    RolePermissionQuerySet,
)

RolePermissionManager = BaseManager.from_queryset(RolePermissionQuerySet)
