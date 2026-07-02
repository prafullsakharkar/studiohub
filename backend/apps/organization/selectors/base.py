"""
Base selector for the Organization bounded context.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector


class OrganizationBaseSelector(BaseSelector):
    """
    Base selector for the Organization domain.

    Shared read logic for:

        - Organization
        - Department
        - Team
        - Membership
        - Office
        - Invitation
    """

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Applications must override this.
        """
        raise NotImplementedError

    @classmethod
    def for_organization(
        cls,
        organization,
    ):
        return cls.filter(
            organization=organization,
        )

    @classmethod
    def active(cls):
        return cls.get_queryset().active()

    @classmethod
    def inactive(cls):
        return cls.get_queryset().inactive()
