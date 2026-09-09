"""
Contract selectors.

Selectors are responsible for read-only queries.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.models import ClientContract, VendorContract

from .base import OrganizationBaseSelector


class ClientContractSelector(OrganizationBaseSelector):
    """
    Read-only queries for ClientContract.
    """

    model = ClientContract

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet[ClientContract]:
        return cls.model.objects.get_queryset().select_related(
            "organization",
            "client",
        )

    @classmethod
    def for_client(cls, client):
        return cls.filter(client=client)

    @classmethod
    def active_for_client(cls, client):
        return cls.filter(client=client, status="Active")


class VendorContractSelector(OrganizationBaseSelector):
    """
    Read-only queries for VendorContract.
    """

    model = VendorContract

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet[VendorContract]:
        return cls.model.objects.get_queryset().select_related(
            "organization",
            "vendor",
        )

    @classmethod
    def for_vendor(cls, vendor):
        return cls.filter(vendor=vendor)

    @classmethod
    def active_for_vendor(cls, vendor):
        return cls.filter(vendor=vendor, status="Active")
