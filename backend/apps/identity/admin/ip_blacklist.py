from django.contrib import admin

from apps.identity.models import IPBlacklist


@admin.register(IPBlacklist)
class IPBlacklistAdmin(admin.ModelAdmin):
    list_display = (
        "ip_address",
        "network",
        "description",
        "reason",
        "is_active",
        "expired",
        "created_at",
    )

    list_filter = (
        "is_active",
        "created_at",
        "expires_at",
    )

    search_fields = (
        "ip_address",
        "network",
        "description",
        "reason",
    )

    readonly_fields = (
        "id",
        "last_hit_at",
        "hit_count",
        "created_at",
        "updated_at",
    )

    date_hierarchy = "created_at"

    ordering = ("ip_address",)
