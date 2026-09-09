from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import UserSession


@admin.register(UserSession)
class UserSessionAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "session_key",
        "user",
        "organization",
        "status",
        "authentication_method",
        "ip_address",
        "is_trusted",
        "started_at",
        "last_activity",
    )

    list_filter = (
        "status",
        "authentication_method",
        "is_trusted",
        "is_current",
        "organization",
    )

    search_fields = (
        "session_key",
        "user__email",
        "ip_address",
        "device_name",
    )

    autocomplete_fields = (
        "user",
        "organization",
        "office",
        "department",
        "team",
    )

    list_select_related = ("user", "organization")

    date_hierarchy = "started_at"

    ordering = ("-last_activity",)
