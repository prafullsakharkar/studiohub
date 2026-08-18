"""
Organization user preference admin configuration.
"""

from django.contrib import admin

from apps.organization.models import UserPreference


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    """Admin for UserPreference."""

    list_display = (
        "user",
        "language",
        "timezone",
        "theme",
        "date_format",
        "time_format",
        "created_at",
    )

    list_filter = (
        "language",
        "timezone",
        "theme",
        "created_at",
    )

    search_fields = ("user__email",)

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
