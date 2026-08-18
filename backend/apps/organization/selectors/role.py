from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.organization.models import Role


class RoleSelector(BaseSelector):
    """
    Selector for Role model.
    """

    model = Role

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Get role queryset.
        """
        queryset = Role.objects.all()

        if request and hasattr(request, "user"):
            # Users can see roles in their organizations
            if not request.user.is_superuser:
                queryset = queryset.filter(
                    organization__in=request.user.organizations.all()
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
        Return system roles.
        """
        return cls.get_queryset().system()

    @classmethod
    def custom(cls):
        """
        Return custom roles.
        """
        return cls.get_queryset().custom()

    @classmethod
    def assignable(cls):
        """
        Return assignable roles.
        """
        return cls.get_queryset().assignable()
