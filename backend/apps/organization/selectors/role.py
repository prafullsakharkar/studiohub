from __future__ import annotations

from django.db.models import Count, QuerySet

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

        # Staff/superusers see everything (admin context, matching
        # OrganizationBaseSelector.scope_by_request). Other users can
        # see roles in their organizations.
        user = getattr(request, "user", None) if request else None
        if user is not None and not (user.is_staff or user.is_superuser):
            queryset = queryset.filter(
                organization__in=user.organizations.all()
            )

        queryset = queryset.annotate(
            user_count=Count("role_users", distinct=True),
            permission_count=Count("role_permissions", distinct=True),
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
