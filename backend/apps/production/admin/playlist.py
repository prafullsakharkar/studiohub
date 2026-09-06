from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Playlist


@admin.register(Playlist)
class PlaylistAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "status",
        "client_only",
        "is_archived",
    )

    list_filter = (
        "status",
        "client_only",
        "is_archived",
        "organization",
    )

    search_fields = (
        "code",
        "name",
    )

    autocomplete_fields = ("project", "organization")

    list_select_related = ("project", "organization")

    ordering = ("name",)
