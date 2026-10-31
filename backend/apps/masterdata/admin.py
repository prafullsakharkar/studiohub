"""
Django admin for masterdata: read-only (docs/masterdata/PLAN.md WP 8.2, finding L1).

Every masterdata write goes through a service, which validates, takes the locks, keeps the
hierarchies and the one-primary/one-headquarters rules, and writes the audit event. An admin
form would skip all of that, so the admin only looks: no add, no change, no delete, no bulk
delete action. Fields that need ``masterdata.person.view_sensitive`` or
``masterdata.client.view_financial`` in the API are left out of the admin as well, so it is not
a way around that gate.
"""

from __future__ import annotations

from typing import Any

from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.masterdata.models import (
    Client,
    ClientContact,
    ClientContract,
    Department,
    MasterAssetType,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
    Office,
    Person,
    Position,
    Software,
    SoftwareVersion,
    Team,
    TeamMembership,
    Vendor,
    VendorContact,
    VendorContract,
)

#: Gated in the API by ``client.view_financial``; the models list their other gated fields in
#: ``audit_exclude_fields``.
FINANCIAL_FIELDS = {
    ClientContract: ("value_usd",),
    VendorContract: ("total_value_usd",),
}


class ReadOnlyAdmin(PlatformScopedModelAdmin):
    def has_add_permission(self, request: Any) -> bool:
        return False

    def has_change_permission(self, request: Any, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False

    def get_actions(self, request: Any) -> dict[str, Any]:
        return {}

    def get_exclude(self, request: Any, obj: Any = None) -> tuple[str, ...]:
        personal = getattr(self.model, "audit_exclude_fields", ())
        return (*personal, *FINANCIAL_FIELDS.get(self.model, ()))


class _CatalogAdmin(ReadOnlyAdmin):
    list_display = ("name", "code", "status", "is_system", "sort_order")
    list_filter = ("status", "is_system")
    search_fields = ("name", "code")
    ordering = ("sort_order", "name")


for _model in (MasterTaskType, MasterAssetType, MasterShotType, MasterReviewType, MasterFileType):
    admin.site.register(_model, _CatalogAdmin)


@admin.register(MasterStatus)
class MasterStatusAdmin(_CatalogAdmin):
    list_display = ("name", "code", "entity_type", "status", "is_default", "is_final")
    list_filter = ("entity_type", "status", "is_default", "is_final")
    ordering = ("entity_type", "order", "name")  # statuses use ``order``, not ``sort_order``


@admin.register(Software)
class SoftwareAdmin(_CatalogAdmin):
    list_display = ("name", "code", "publisher", "status", "is_system")
    list_filter = ("status", "is_system", "category")


@admin.register(SoftwareVersion)
class SoftwareVersionAdmin(ReadOnlyAdmin):
    list_display = ("software", "version", "code", "status", "release_date")
    list_filter = ("status",)
    search_fields = ("version", "code", "software__name")


@admin.register(Department)
class DepartmentAdmin(ReadOnlyAdmin):
    list_display = ("name", "code", "department_type", "parent")
    list_filter = ("department_type",)
    search_fields = ("name", "code")


@admin.register(Team)
class TeamAdmin(ReadOnlyAdmin):
    list_display = ("name", "code", "department")
    search_fields = ("name", "code")


@admin.register(TeamMembership)
class TeamMembershipAdmin(ReadOnlyAdmin):
    # The person is identified by id only: the name is personal data.
    list_display = ("id", "team", "person", "created_at")
    search_fields = ("team__name", "team__code")


@admin.register(Office)
class OfficeAdmin(ReadOnlyAdmin):
    list_display = ("name", "code", "city", "country", "is_active", "is_headquarters")
    list_filter = ("is_active", "is_headquarters", "country")
    search_fields = ("name", "code", "city")


@admin.register(Position)
class PositionAdmin(ReadOnlyAdmin):
    list_display = ("name", "code", "department", "level", "is_managerial")
    list_filter = ("is_managerial",)
    search_fields = ("name", "code")


@admin.register(Person)
class PersonAdmin(ReadOnlyAdmin):
    # The name is personal data (the model keeps it out of audit snapshots), so the list
    # identifies a person by department and status only.
    list_display = ("id", "department", "team", "office", "status")
    list_filter = ("status",)


@admin.register(Client)
class ClientAdmin(ReadOnlyAdmin):
    list_display = ("name", "code", "status", "studio_type")
    list_filter = ("status",)
    search_fields = ("name", "code")


@admin.register(Vendor)
class VendorAdmin(ReadOnlyAdmin):
    list_display = ("name", "code", "status", "specialization")
    list_filter = ("status",)
    search_fields = ("name", "code")


@admin.register(ClientContact)
class ClientContactAdmin(ReadOnlyAdmin):
    list_display = ("id", "client", "is_primary")


@admin.register(VendorContact)
class VendorContactAdmin(ReadOnlyAdmin):
    list_display = ("id", "vendor", "is_primary")


@admin.register(ClientContract)
class ClientContractAdmin(ReadOnlyAdmin):
    list_display = ("contract_number", "client", "type", "status", "effective_date", "expiry_date")
    list_filter = ("type", "status")
    search_fields = ("contract_number", "title")


@admin.register(VendorContract)
class VendorContractAdmin(ReadOnlyAdmin):
    list_display = ("contract_number", "vendor", "type", "status", "effective_date", "expiry_date")
    list_filter = ("type", "status")
    search_fields = ("contract_number", "title")
