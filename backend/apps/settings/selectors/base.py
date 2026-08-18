"""
Base selector for the Settings bounded context.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector


class SettingsBaseSelector(BaseSelector):
    """
    Base selector for the Settings domain.

    Shared read logic for:

        - SystemSettings
        - EmailSettings
        - NotificationSettings
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
    def _scope_by_request(
        cls,
        queryset: QuerySet,
        request=None,
    ) -> QuerySet:
        """
        Restrict org-scoped settings to the caller's organizations.

        Regular users only see settings for organizations they belong to.
        Staff and superusers see everything. When the model supports a
        ``null`` organization (default themes / localizations), those
        platform defaults remain visible to all authenticated users.
        """
        if request is None:
            return queryset

        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return queryset.none()

        if user.is_staff or user.is_superuser:
            return queryset

        from django.db.models import Q

        organization_ids = list(
            user.organizations.values_list("id", flat=True),
        )

        return queryset.filter(
            Q(organization_id__in=organization_ids)
            | Q(organization__isnull=True),
        )

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
