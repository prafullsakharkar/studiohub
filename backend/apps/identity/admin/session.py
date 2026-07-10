from django.contrib import admin

from apps.identity.models import Session


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "ip_address",
        "is_active",
        "expires_at",
        "last_activity_at",
    )

    list_filter = ("is_active",)

    search_fields = (
        "user__email",
        "session_key",
    )

    readonly_fields = (
        "id",
        "session_key",
        "created_at",
        "updated_at",
    )
