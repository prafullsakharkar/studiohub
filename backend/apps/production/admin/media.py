from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Media


@admin.register(Media)
class MediaAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "entity_type",
        "entity_id",
        "media_type",
        "category",
        "project",
        "file_format",
        "storage_tier",
    )

    list_filter = (
        "media_type",
        "category",
        "storage_tier",
    )

    search_fields = (
        "entity_id",
        "entity_type",
        "category",
    )

    autocomplete_fields = ("project",)

    list_select_related = ("project",)

    ordering = ("-created_at",)
