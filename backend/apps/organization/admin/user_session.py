"""
Organization user session admin configuration.
"""

from django.contrib import admin

from apps.organization.models import UserSession


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    """Admin for UserSession."""

    list_display = (
        "user",
        "organization",
        "status",
        "authentication_method",
        "ip_address",
        "created_at",
    )

    list_filter = (
        "status",
        "authentication_method",
        "device_type",
        "created_at",
    )

    search_fields = (
        "user__email",
        "ip_address",
        "session_token",
    )

    readonly_fields = (
        "id",
        "session_token",
        "created_at",
        "updated_at",
    )
