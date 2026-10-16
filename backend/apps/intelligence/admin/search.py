from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.intelligence.models import RecentSearch, SavedSearch


@admin.register(SavedSearch)
class SavedSearchAdmin(PlatformScopedModelAdmin):
    list_display = (
        "name",
        "user",
        "is_favorite",
        "updated_at",
    )

    list_filter = (
        "is_favorite",
    )

    search_fields = (
        "name",
        "description",
    )

    autocomplete_fields = ("user",)

    list_select_related = ("user",)

    ordering = ("-updated_at",)


@admin.register(RecentSearch)
class RecentSearchAdmin(PlatformScopedModelAdmin):
    list_display = (
        "query",
        "user",
        "created_at",
    )

    list_filter = ()

    search_fields = ("query",)

    autocomplete_fields = ("user",)

    list_select_related = ("user",)

    ordering = ("-created_at",)
