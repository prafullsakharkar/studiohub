from apps.core.models.querysets.base import BaseQuerySet
from apps.identity.choices import timezone


class RolePermissionQuerySet(
    BaseQuerySet,
):

    def active(self):
        return self.filter(granted=True)

    def expired(self):
        return self.filter(expires_at__lt=timezone.now())

    def by_role(self, role):
        return self.filter(role=role)

    def by_permission(self, permission):
        return self.filter(permission=permission)
