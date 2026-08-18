from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.permission import PermissionQuerySet

PermissionManager = BaseManager.from_queryset(PermissionQuerySet)
