from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.models import Playlist


@admin.register(Playlist)
class PlaylistAdmin(StudioHubModelAdmin):
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
    )

    search_fields = (
        "code",
        "name",
    )

    autocomplete_fields = ("project",)

    list_select_related = ("project",)

    ordering = ("name",)
