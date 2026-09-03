from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.organization.models import Permission


class PermissionSelector(BaseSelector):
    """
    Selector for Permission model.
    """

    model = Permission

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Get permission queryset.
        """
        queryset = Permission.objects.all()

        # Users can see permissions in their organizations
        if request and hasattr(request, "user") and not request.user.is_superuser:
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
    def by_module(cls, module):
        """
        Filter by module.
        """
        return cls.get_queryset().by_module(module)

    @classmethod
    def by_action(cls, action):
        """
        Filter by action.
        """
        return cls.get_queryset().by_action(action)

    @classmethod
    def system(cls):
        """
        Return system permissions.
        """
        return cls.get_queryset().system()

    @classmethod
    def custom(cls):
        """
        Return custom permissions.
        """
        return cls.get_queryset().custom()
