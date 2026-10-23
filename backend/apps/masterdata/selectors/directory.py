"""
Global directory selectors (org-removal B3).

Org-free read accessors for the platform directory. The global directory
has no tenant partition: ``scope_by_request`` is the inherited platform
no-op (project narrowing only).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Count, Q, QuerySet

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


class _DirectorySelector(BaseSelector):
    """Live rows for reads; ``with_deleted`` for restore and hard delete only."""

    @classmethod
    def _build(cls, manager) -> QuerySet[Any]:
        return manager.all()

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any]:
        return cls._build(cls.model.objects)  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]

    @classmethod
    def with_deleted(cls) -> QuerySet[Any]:
        return cls._build(cls.model.all_objects)  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]


class DepartmentSelector(_DirectorySelector):
    model = Department

    @classmethod
    def _build(cls, manager) -> QuerySet[Any]:
        return manager.select_related("parent", "manager")


class TeamSelector(_DirectorySelector):
    model = Team

    @classmethod
    def _build(cls, manager) -> QuerySet[Any]:
        return manager.select_related("department", "lead")


class OfficeSelector(_DirectorySelector):
    model = Office

    @classmethod
    def _build(cls, manager) -> QuerySet[Any]:
        # ``headcount`` is computed, not read from the stored column (DECISIONS D11).
        return manager.select_related("manager").annotate(
            live_headcount=Count(
                "persons",
                filter=Q(persons__is_deleted=False, persons__status="active"),
                distinct=True,
            )
        )


class PositionSelector(_DirectorySelector):
    model = Position

    @classmethod
    def _build(cls, manager) -> QuerySet[Any]:
        return manager.select_related("department", "parent")


class PersonSelector(_DirectorySelector):
    model = Person

    @classmethod
    def _build(cls, manager) -> QuerySet[Any]:
        return manager.select_related("user", "role", "department", "team", "office")


class _PartnerSelector(BaseSelector):
    """Selector for clients and vendors, with a live contact count in the same query."""

    @classmethod
    def _counted(cls, manager) -> QuerySet[Any]:
        live_contacts = Q(contacts__is_deleted=False)
        return manager.annotate(
            contact_count=Count("contacts", filter=live_contacts, distinct=True)
        )

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any]:
        return cls._counted(cls.model.objects)  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]

    @classmethod
    def with_deleted(cls) -> QuerySet[Any]:
        """Every row, soft-deleted included (restore and hard delete only)."""
        return cls._counted(cls.model.all_objects)  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]


class ClientSelector(_PartnerSelector):
    model = Client


class VendorSelector(_PartnerSelector):
    model = Vendor


class _OwnedSelector(BaseSelector):
    """Selector for rows that belong to a client or vendor (contacts, contracts)."""

    parent_field: str  # pyright: ignore[reportUninitializedInstanceVariable]

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any]:
        return cls.model.objects.select_related(cls.parent_field)  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]

    @classmethod
    def with_deleted(cls) -> QuerySet[Any]:
        return cls.model.all_objects.select_related(cls.parent_field)  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]


class ClientContactSelector(_OwnedSelector):
    model = ClientContact
    parent_field = "client"


class ClientContractSelector(_OwnedSelector):
    model = ClientContract
    parent_field = "client"


class VendorContactSelector(_OwnedSelector):
    model = VendorContact
    parent_field = "vendor"


class VendorContractSelector(_OwnedSelector):
    model = VendorContract
    parent_field = "vendor"
