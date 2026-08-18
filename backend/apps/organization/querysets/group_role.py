from __future__ import annotations

from django.db import models

from apps.core.models.querysets.base import BaseQuerySet


class GroupRoleQuerySet(BaseQuerySet):
    """
    QuerySet for GroupRole model.
    """

    def for_group(self, group):
        """
        Filter by group.
        """
        return self.filter(group=group)

    def for_role(self, role):
        """
        Filter by role.
        """
        return self.filter(role=role)

    def with_related(self):
        """
        Prefetch related objects.
        """
        return self.select_related("group", "role")
