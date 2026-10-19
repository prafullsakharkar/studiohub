from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.models import UserPreference


@admin.register(UserPreference)
class UserPreferenceAdmin(PlatformScopedModelAdmin):
    list_display = (
        "user",
        "language",
        "timezone",
        "theme",
        "start_page",
        "items_per_page",
    )

    list_filter = ("language", "theme")

    search_fields = ("user__email", "user__username")

    list_select_related = ("user",)
