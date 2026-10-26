from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Version


@admin.register(Version)
class VersionAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "code",
        "version_number",
        "entity_type",
        "entity_code",
        "project",
        "status",
        "is_published",
        "is_hero",
        "is_archived",
    )

    list_filter = (
        "status",
        "entity_type",
        "is_published",
        "is_hero",
        "is_archived",
    )

    search_fields = (
        "code",
        "entity_code",
        "entity_name",
    )

    autocomplete_fields = (
        "project",
        "shot",
        "asset",
        "task",
        "artist",
    )

    list_select_related = ("project",)

    ordering = ("-created_at",)
