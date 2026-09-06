from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.identity.models import KnownDevice


@admin.register(KnownDevice)
class KnownDeviceAdmin(StudioHubModelAdmin):
    """Admin for KnownDevice."""

    list_display = (
        "fingerprint",
        "user",
        "browser",
        "platform",
        "device_type",
        "is_trusted",
        "last_seen_at",
    )

    list_filter = (
        "is_trusted",
        "device_type",
        "platform",
    )

    search_fields = (
        "fingerprint",
        "user__email",
    )

    autocomplete_fields = ("user",)

    list_select_related = ("user",)

    ordering = ("-last_seen_at",)
