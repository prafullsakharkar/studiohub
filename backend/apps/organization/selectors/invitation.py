"""
Invitation selectors.

Selectors are responsible for read-only queries.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.models import Invitation

from .base import OrganizationBaseSelector


class InvitationSelector(OrganizationBaseSelector):
    """
    Read-only queries for Invitation.
    """

    model = Invitation

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Return invitations scoped to the requesting user's organizations.

        Staff users may see all invitations; regular users are limited
        to organizations they belong to.
        """
        queryset = Invitation.objects.select_related(
            "organization",
            "role",
            "department",
            "team",
            "invited_by",
            "accepted_by",
        )

        if request and hasattr(request, "user"):
            user = request.user

            if not user.is_superuser:
                queryset = queryset.filter(
                    organization__in=user.organizations.all(),
                )

        return queryset

    @classmethod
    def pending(cls):
        return cls.get_queryset().pending()

    @classmethod
    def by_organization(cls, organization):
        return cls.filter(organization=organization)

    @classmethod
    def by_email(cls, email):
        return cls.filter(email=email)
