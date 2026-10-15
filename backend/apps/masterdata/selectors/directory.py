"""
Global directory selectors (org-removal B3).

Org-free read accessors for the platform directory. The global directory
has no tenant partition: ``scope_by_request`` is the inherited platform
no-op (project narrowing only).
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.masterdata.models import (
    Client,
    ClientContact,
    ClientContract,
    Department,
    Office,
    Person,
    Position,
    Team,
    Vendor,
    VendorContact,
    VendorContract,
)


class DepartmentSelector(BaseSelector):
    model = Department

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Department]:
        return Department.objects.select_related("parent", "manager").all()


class TeamSelector(BaseSelector):
    model = Team

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Team]:
        return Team.objects.select_related("department", "lead").all()


class OfficeSelector(BaseSelector):
    model = Office

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Office]:
        return Office.objects.select_related("manager").all()


class PositionSelector(BaseSelector):
    model = Position

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Position]:
        return Position.objects.select_related("department", "parent").all()


class PersonSelector(BaseSelector):
    model = Person

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Person]:
        return Person.objects.select_related("user", "role", "department", "team", "office").all()


class ClientSelector(BaseSelector):
    model = Client

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Client]:
        return Client.objects.prefetch_related("contacts", "contracts").all()


class VendorSelector(BaseSelector):
    model = Vendor

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Vendor]:
        return Vendor.objects.prefetch_related("contacts", "contracts").all()


class ClientContactSelector(BaseSelector):
    model = ClientContact

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[ClientContact]:
        return ClientContact.objects.select_related("client").all()


class ClientContractSelector(BaseSelector):
    model = ClientContract

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[ClientContract]:
        return ClientContract.objects.select_related("client").all()


class VendorContactSelector(BaseSelector):
    model = VendorContact

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[VendorContact]:
        return VendorContact.objects.select_related("vendor").all()


class VendorContractSelector(BaseSelector):
    model = VendorContract

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[VendorContract]:
        return VendorContract.objects.select_related("vendor").all()
