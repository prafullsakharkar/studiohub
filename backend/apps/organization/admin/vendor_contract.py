from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import VendorContract


@admin.register(VendorContract)
class VendorContractAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "contract_number",
        "title",
        "vendor",
        "type",
        "status",
        "total_value_usd",
        "security_tier",
        "effective_date",
        "expiry_date",
    )

    list_filter = (
        "type",
        "status",
        "nda_signed",
        "organization",
    )

    search_fields = (
        "contract_number",
        "title",
    )

    autocomplete_fields = ("vendor", "organization")

    list_select_related = ("vendor", "organization")

    date_hierarchy = "effective_date"

    ordering = ("contract_number",)
