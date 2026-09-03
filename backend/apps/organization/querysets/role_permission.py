from __future__ import annotations

from apps.core.models.querysets.base import BaseQuerySet


class RolePermissionQuerySet(BaseQuerySet):
    """
    QuerySet for RolePermission model.
    """

    def for_role(self, role):
        """
        Filter by role.
        """
        return self.filter(role=role)

    def for_permission(self, permission):
        """
        Filter by permission.
        """
        return self.filter(permission=permission)

    def granted(self):
        """
        Return granted permissions.
        """
        return self.filter(granted=True)

    def revoked(self):
        """
        Return revoked permissions.
        """
        return self.filter(granted=False)

    def with_related(self):
        """
        Prefetch related objects.
        """
        return self.select_related("role", "permission", "granted_by")
