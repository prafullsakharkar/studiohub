from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Media


@admin.register(Media)
class MediaAdmin(OrganizationScopedModelAdmin):
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
        "organization",
    )

    search_fields = (
        "entity_id",
        "entity_type",
        "category",
    )

    autocomplete_fields = ("project", "organization")

    list_select_related = ("project", "organization")

    ordering = ("-created_at",)
