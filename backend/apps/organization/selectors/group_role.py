from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.organization.models import GroupRole


class GroupRoleSelector(BaseSelector):
    """
    Selector for GroupRole model.
    """

    model = GroupRole

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Get group role queryset.
        """
        queryset = GroupRole.objects.all()

        # Users can see group roles in their organizations
        if request and hasattr(request, "user") and not request.user.is_superuser:
            queryset = queryset.filter(
                group__organization__in=request.user.organizations.all()
            )

        return queryset

    @classmethod
    def for_group(cls, group):
        """
        Filter by group.
        """
        return cls.get_queryset().filter(group=group)

    @classmethod
    def for_role(cls, role):
        """
        Filter by role.
        """
        return cls.get_queryset().filter(role=role)

    @classmethod
    def with_related(cls):
        """
        Prefetch related objects.
        """
        return cls.get_queryset().with_related()
