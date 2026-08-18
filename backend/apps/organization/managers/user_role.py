from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.user_role import UserRoleQuerySet

UserRoleManager = BaseManager.from_queryset(UserRoleQuerySet)
