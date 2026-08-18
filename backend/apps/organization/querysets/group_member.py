from __future__ import annotations

from django.db import models

from apps.core.models.querysets.base import BaseQuerySet


class GroupMemberQuerySet(BaseQuerySet):
    """
    QuerySet for GroupMember model.
    """

    def for_group(self, group):
        """
        Filter by group.
        """
        return self.filter(group=group)

    def for_user(self, user):
        """
        Filter by user.
        """
        return self.filter(user=user)

    def owners(self):
        """
        Return group owners.
        """
        return self.filter(is_owner=True)

    def managers(self):
        """
        Return group managers.
        """
        return self.filter(is_manager=True)

    def with_related(self):
        """
        Prefetch related objects.
        """
        return self.select_related("group", "user")
