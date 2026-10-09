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
        """
        Return active records.

        Models exposing a ``status`` field are filtered on it; models
        with soft-delete support (``is_deleted``, e.g. Department, Team,
        Office) additionally exclude soft-deleted rows.
        """
        qs = self.all()
        if hasattr(self.model, "status"):
            qs = qs.filter(
                status=RecordStatus.ACTIVE,
            )
        if hasattr(self.model, "is_deleted"):
            qs = qs.filter(is_deleted=False)

        return qs

    def inactive(self):
        """
        Return inactive records.
        """
        if hasattr(self.model, "status"):
            return self.exclude(status=RecordStatus.ACTIVE)

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
        """
        Filter by the UUID primary key.

        ``uuid`` is a property alias for the ``id`` primary key field;
        filtering must target the real column.
        """
        return self.filter(
            id=uuid,
        )
