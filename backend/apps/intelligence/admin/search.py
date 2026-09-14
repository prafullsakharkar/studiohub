from django.contrib import admin

from apps.intelligence.models import RecentSearch, SavedSearch
from apps.organization.admin.base import OrganizationScopedModelAdmin


@admin.register(SavedSearch)
class SavedSearchAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "organization",
        "user",
        "is_favorite",
        "updated_at",
    )

    list_filter = (
        "is_favorite",
        "organization",
    )

    search_fields = (
        "name",
        "description",
    )

    autocomplete_fields = ("organization", "user")

    list_select_related = ("organization", "user")

    ordering = ("-updated_at",)


@admin.register(RecentSearch)
class RecentSearchAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "query",
        "organization",
        "user",
        "created_at",
    )

    list_filter = ("organization",)

    search_fields = ("query",)

    autocomplete_fields = ("organization", "user")

    list_select_related = ("organization", "user")

    ordering = ("-created_at",)
