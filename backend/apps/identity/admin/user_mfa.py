"""
Identity user MFA admin configuration.
"""
from django.contrib import admin

from apps.identity.models import UserMFA


@admin.register(UserMFA)
class UserMFAdmin(admin.ModelAdmin):
    """Admin for UserMFA."""

    list_display = (
        "user",
        "primary_method",
        "status",
        "is_verified",
        "created_at",
    )

    list_filter = (
        "primary_method",
        "status",
        "is_verified",
        "created_at",
    )

    search_fields = (
        "user__email",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
