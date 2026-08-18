from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.organization.models import GroupMember


class GroupMemberSelector(BaseSelector):
    """
    Selector for GroupMember model.
    """

    model = GroupMember

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Get group member queryset.
        """
        queryset = GroupMember.objects.all()

        if request and hasattr(request, "user"):
            # Users can see group members in their organizations
            if not request.user.is_superuser:
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
    def for_user(cls, user):
        """
        Filter by user.
        """
        return cls.get_queryset().filter(user=user)

    @classmethod
    def owners(cls):
        """
        Return group owners.
        """
        return cls.get_queryset().owners()

    @classmethod
    def managers(cls):
        """
        Return group managers.
        """
        return cls.get_queryset().managers()

    @classmethod
    def with_related(cls):
        """
        Prefetch related objects.
        """
        return cls.get_queryset().with_related()
