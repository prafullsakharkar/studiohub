"""
Invitation selectors.

Selectors are responsible for read-only queries.
"""

from __future__ import annotations

from apps.organization.models import Invitation
from apps.organization.querysets.invitation import InvitationQuerySet

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
    ) -> InvitationQuerySet:
        """
        Return invitations scoped to the requesting user's organizations,
        plus invitations addressed to the user (invitees are not members
        yet, but must see and act on their own invitations).

        Staff users may see all invitations; regular users are limited
        to organizations they belong to.
        """
        from django.db.models import Q

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
                scope = Q(organization__in=user.organizations.all())
                user_email = (getattr(user, "email", "") or "").strip()
                if getattr(user, "is_authenticated", False) and user_email:
                    scope = scope | Q(email__iexact=user_email)
                queryset = queryset.filter(scope)

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
