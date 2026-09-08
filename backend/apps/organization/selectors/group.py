from __future__ import annotations

from django.db import models

from apps.core.selectors.base import BaseSelector
from apps.organization.models import Group
from apps.organization.querysets.group import GroupQuerySet


class GroupSelector(BaseSelector):
    """
    Selector for Group model.
    """

    model = Group

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> GroupQuerySet:
        """
        Get group queryset.
        """
        queryset = Group.objects.all()

        # Users can see groups in their organizations
        if request and hasattr(request, "user") and not request.user.is_superuser:
            queryset = queryset.filter(
                models.Q(organization__in=request.user.organizations.all())
                | models.Q(users=request.user)
            )

        return queryset

    @classmethod
    def for_organization(cls, organization):
        """
        Filter by organization.
        """
        return cls.get_queryset().filter(organization=organization)

    @classmethod
    def system(cls):
        """
        Return system groups.
        """
        return cls.get_queryset().system()

    @classmethod
    def custom(cls):
        """
        Return custom groups.
        """
        return cls.get_queryset().custom()
