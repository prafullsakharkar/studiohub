from __future__ import annotations

from django.db import models
from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.organization.models import Group


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
    ) -> QuerySet:
        """
        Get group queryset.
        """
        queryset = Group.objects.all()

        if request and hasattr(request, "user"):
            # Users can see groups in their organizations
            if not request.user.is_superuser:
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
