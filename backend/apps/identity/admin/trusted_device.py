from django.contrib import admin

from apps.identity.models import TrustedDevice


@admin.register(TrustedDevice)
class TrustedDeviceAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "device_name",
        "expires_at",
        "last_used_at",
    )

    search_fields = (
        "user__email",
        "device_name",
    )

    readonly_fields = (
        "uuid",
        "token",
        "created_at",
        "updated_at",
    )
