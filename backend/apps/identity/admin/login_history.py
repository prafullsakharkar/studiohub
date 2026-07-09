from django.contrib import admin

from apps.identity.models import LoginHistory


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "ip_address",
        "success",
        "created_at",
    )

    list_filter = ("success",)

    search_fields = (
        "user__email",
        "ip_address",
    )

    readonly_fields = (
        "uuid",
        "created_at",
    )
