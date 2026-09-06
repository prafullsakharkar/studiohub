from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Asset


@admin.register(Asset)
class AssetAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "category",
        "status",
        "version",
        "is_archived",
    )

    list_filter = (
        "category",
        "status",
        "is_archived",
        "organization",
    )

    search_fields = (
        "code",
        "name",
    )

    autocomplete_fields = (
        "project",
        "organization",
        "department",
        "team",
        "assigned_artist",
        "parent_asset",
    )

    list_select_related = ("project", "organization")

    ordering = ("code",)
