from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.organization.models import UserPreference


@admin.register(UserPreference)
class UserPreferenceAdmin(StudioHubModelAdmin):
    """Per-user preferences carry no organization FK: no tenant scoping."""

    list_display = (
        "user",
        "language",
        "timezone",
        "theme",
        "items_per_page",
    )

    list_filter = (
        "language",
        "theme",
    )

    search_fields = ("user__email",)

    autocomplete_fields = (
        "user",
        "default_organization",
        "default_department",
    )

    list_select_related = ("user",)
