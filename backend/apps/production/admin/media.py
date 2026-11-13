from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Media, ReviewMedia


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


@admin.register(ReviewMedia)
class ReviewMediaAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    """Read-only: rows are written by ``ReviewMediaService`` and the media worker only (RP-5, C-RP-19)."""

    list_display = (
        "version",
        "kind",
        "status",
        "error_code",
        "attempts",
        "queued_at",
        "finished_at",
    )
    list_filter = ("status", "kind", "error_code")
    search_fields = ("version__code",)
    readonly_fields = tuple(field.name for field in ReviewMedia._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
