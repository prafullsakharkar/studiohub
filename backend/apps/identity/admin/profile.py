"""
Identity profile admin configuration.
"""
from django.contrib import admin

from apps.identity.models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """Admin for Profile."""

    list_display = (
        "user",
        "display_name",
        "first_name",
        "last_name",
        "phone",
        "created_at",
    )

    list_filter = (
        "created_at",
    )

    search_fields = (
        "user__email",
        "display_name",
        "first_name",
        "last_name",
        "phone",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
