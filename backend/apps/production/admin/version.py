from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Version


@admin.register(Version)
class VersionAdmin(OrganizationScopedModelAdmin):
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
        "organization",
    )

    search_fields = (
        "code",
        "entity_code",
        "entity_name",
    )

    autocomplete_fields = (
        "project",
        "organization",
        "shot",
        "asset",
        "task",
        "artist",
    )

    list_select_related = ("project", "organization")

    ordering = ("-created_at",)
