from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import ClientContact


@admin.register(ClientContact)
class ClientContactAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "client",
        "organization",
        "role",
        "email",
        "is_primary",
        "portal_access",
    )

    list_filter = (
        "is_primary",
        "portal_access",
        "organization",
    )

    search_fields = (
        "name",
        "email",
        "role",
    )

    autocomplete_fields = ("client", "organization")

    list_select_related = ("client", "organization")

    ordering = ("name",)
