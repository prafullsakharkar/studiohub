"""
Contact selectors.

Selectors are responsible for read-only queries.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.models import ClientContact, VendorContact

from .base import OrganizationBaseSelector


class ClientContactSelector(OrganizationBaseSelector):
    """
    Read-only queries for ClientContact.
    """

    model = ClientContact

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return cls.model.objects.select_related(
            "organization",
            "client",
        )

    @classmethod
    def for_client(cls, client):
        return cls.filter(client=client)

    @classmethod
    def primary_for_client(cls, client):
        return cls.filter(client=client, is_primary=True).first()


class VendorContactSelector(OrganizationBaseSelector):
    """
    Read-only queries for VendorContact.
    """

    model = VendorContact

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return cls.model.objects.select_related(
            "organization",
            "vendor",
        )

    @classmethod
    def for_vendor(cls, vendor):
        return cls.filter(vendor=vendor)

    @classmethod
    def primary_for_vendor(cls, vendor):
        return cls.filter(vendor=vendor, is_primary=True).first()
