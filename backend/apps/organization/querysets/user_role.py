from __future__ import annotations

from apps.core.models.querysets.base import BaseQuerySet


class UserRoleQuerySet(BaseQuerySet):
    """
    QuerySet for UserRole model.
    """

    def for_user(self, user):
        """
        Filter by user.
        """
        return self.filter(user=user)

    def for_role(self, role):
        """
        Filter by role.
        """
        return self.filter(role=role)

    def with_related(self):
        """
        Prefetch related objects.
        """
        return self.select_related("user", "role")
