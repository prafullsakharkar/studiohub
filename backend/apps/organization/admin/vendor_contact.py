from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import VendorContact


@admin.register(VendorContact)
class VendorContactAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "vendor",
        "organization",
        "role",
        "email",
        "is_primary",
    )

    list_filter = (
        "is_primary",
        "organization",
    )

    search_fields = (
        "name",
        "email",
        "role",
    )

    autocomplete_fields = ("vendor", "organization")

    list_select_related = ("vendor", "organization")

    ordering = ("name",)
