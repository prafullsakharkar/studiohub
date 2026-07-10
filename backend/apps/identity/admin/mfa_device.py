from django.contrib import admin

from apps.identity.models import MFADevice


@admin.register(MFADevice)
class MFADeviceAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "device_type",
        "is_primary",
        "is_verified",
        "created_at",
    )

    list_filter = (
        "device_type",
        "is_primary",
        "is_verified",
    )

    search_fields = (
        "user__email",
        "name",
    )

    readonly_fields = (
        "id",
        "secret",
        "created_at",
        "updated_at",
    )
