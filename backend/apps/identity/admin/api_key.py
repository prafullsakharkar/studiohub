from django.contrib import admin

from apps.identity.models import APIKey


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "organization",
        "is_active",
        "expires_at",
        "last_used_at",
    )

    list_filter = ("is_active",)

    search_fields = (
        "name",
        "prefix",
    )

    readonly_fields = (
        "id",
        "prefix",
        "hashed_key",
        "last_used_at",
        "last_used_ip",
        "created_at",
        "updated_at",
    )
