from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.identity.models import SecurityEvent


@admin.register(SecurityEvent)
class SecurityEventAdmin(StudioHubModelAdmin):
    """Admin for SecurityEvent."""

    list_display = (
        "event_type",
        "user",
        "ip_address",
        "is_critical",
        "occurred_at",
    )

    list_filter = (
        "event_type",
        "is_critical",
    )

    search_fields = (
        "event_type",
        "description",
        "user__email",
        "ip_address",
    )

    autocomplete_fields = ("user",)

    list_select_related = ("user",)

    date_hierarchy = "occurred_at"

    ordering = ("-occurred_at",)
