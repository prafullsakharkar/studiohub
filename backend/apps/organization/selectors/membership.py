"""
OrganizationMembership selectors.

Selectors are responsible for read-only queries.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.models import OrganizationMembership

from .base import OrganizationBaseSelector


class OrganizationMembershipSelector(OrganizationBaseSelector):
    """
    Read-only queries for OrganizationMembership.
    """

    model = OrganizationMembership

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Return memberships scoped to the requesting user's organizations.

        Staff users may see all memberships; regular users are limited
        to organizations they belong to.
        """
        queryset = OrganizationMembership.objects.select_related(
            "user",
            "organization",
            "department",
            "team",
            "office",
            "role",
        )

        if request and hasattr(request, "user"):
            user = request.user

            if not user.is_superuser:
                queryset = queryset.filter(
                    organization__in=user.organizations.all(),
                )

        return queryset

    @classmethod
    def active(cls):
        return cls.get_queryset().active()

    @classmethod
    def by_organization(cls, organization):
        return cls.filter(organization=organization)

    @classmethod
    def by_user(cls, user):
        return cls.filter(user=user)

    @classmethod
    def primary(cls):
        return cls.get_queryset().primary()
