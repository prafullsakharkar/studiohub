"""
Organization settings selector.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.models import OrganizationSettings

from .base import OrganizationBaseSelector


class OrganizationSettingsSelector(
    OrganizationBaseSelector,
):
    """
    Read operations for OrganizationSettings.
    """

    model = OrganizationSettings

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return OrganizationSettings.objects.with_organization()

    @classmethod
    def get_by_organization(
        cls,
        organization,
    ):
        return cls.get_queryset().get(organization=organization)
