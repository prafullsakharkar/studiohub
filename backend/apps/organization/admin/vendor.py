from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import Vendor


@admin.register(Vendor)
class VendorAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "code",
        "organization",
        "status",
        "specialization",
        "nda_signed",
        "rating",
        "created_at",
    )

    list_filter = (
        "status",
        "specialization",
        "nda_signed",
        "organization",
    )

    search_fields = (
        "name",
        "code",
        "contact_name",
        "email",
    )

    autocomplete_fields = ("organization",)

    list_select_related = ("organization",)

    ordering = ("name",)
