from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import Client


@admin.register(Client)
class ClientAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "code",
        "organization",
        "status",
        "contract_tier",
        "portal_access",
        "total_billed_usd",
        "created_at",
    )

    list_filter = (
        "status",
        "studio_type",
        "contract_tier",
        "portal_access",
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
