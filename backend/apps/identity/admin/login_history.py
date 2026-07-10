from django.contrib import admin

from apps.identity.models import LoginHistory


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "ip_address",
        "status",
        "created_at",
    )

    list_filter = ("status",)

    search_fields = (
        "user__email",
        "ip_address",
    )

    readonly_fields = (
        "id",
        "created_at",
    )
