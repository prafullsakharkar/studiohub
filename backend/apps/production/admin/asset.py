from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Asset


@admin.register(Asset)
class AssetAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
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
    )

    search_fields = (
        "code",
        "name",
    )

    autocomplete_fields = (
        "project",
        "assigned_artist",
        "parent_asset",
    )

    list_select_related = ("project",)

    ordering = ("code",)
