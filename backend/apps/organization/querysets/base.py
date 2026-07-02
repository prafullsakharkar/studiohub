"""
Base QuerySet for the Organization bounded context.
"""

from __future__ import annotations

from django.db import models

from apps.core.choices.record import RecordStatus
from apps.core.models.querysets.base import BaseQuerySet


class OrganizationEntityQuerySet(BaseQuerySet):
    """
    Shared QuerySet for Organization entities.

    Used by:

        • Department
        • Team
        • Office
    """

    def active(self):
        return self.filter(
            status=RecordStatus.ACTIVE,
        )

    def inactive(self):
        """
        Return inactive records.
        """
        if hasattr(self.model, "status"):
            return self.exclude(status="active")

        return self.none()

    def by_code(self, code: str):
        """
        Filter by code.
        """
        return self.filter(code=code)

    def search(self, value: str):
        """
        Search by code or name.
        """
        return self.filter(
            models.Q(code__icontains=value) | models.Q(name__icontains=value)
        )

    def ordered(self):
        """
        Default ordering.
        """
        return self.order_by("name")

    def for_organization(self, organization):
        """
        Filter by organization.
        """
        return self.filter(
            organization=organization,
        )

    def by_name(self, name):
        return self.filter(
            name__icontains=name,
        )

    def by_uuid(self, uuid):
        return self.filter(
            uuid=uuid,
        )
