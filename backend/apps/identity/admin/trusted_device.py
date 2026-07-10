from django.contrib import admin

from apps.identity.models import TrustedDevice


@admin.register(TrustedDevice)
class TrustedDeviceAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "platform",
        "expires_at",
        "last_login_at",
    )

    search_fields = (
        "user__email",
        "platform",
    )

    readonly_fields = (
        "id",
        "fingerprint",
        "created_at",
        "updated_at",
    )
