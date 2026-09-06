from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import ClientContract


@admin.register(ClientContract)
class ClientContractAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "contract_number",
        "title",
        "client",
        "type",
        "status",
        "value_usd",
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

    autocomplete_fields = ("client", "organization")

    list_select_related = ("client", "organization")

    date_hierarchy = "effective_date"

    ordering = ("contract_number",)
