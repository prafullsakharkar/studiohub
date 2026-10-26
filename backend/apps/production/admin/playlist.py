from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Playlist, PlaylistEntry


@admin.register(Playlist)
class PlaylistAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "status",
        "client_only",
        "is_deleted",
    )

    list_filter = (
        "status",
        "client_only",
        "is_deleted",
    )

    search_fields = (
        "code",
        "name",
    )

    autocomplete_fields = ("project",)

    list_select_related = ("project",)

    ordering = ("name",)


@admin.register(PlaylistEntry)
class PlaylistEntryAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    """Entries (D-31) are written through the API; the admin is for looking."""

    list_display = ("playlist", "version", "position", "is_deleted")
    list_filter = ("is_deleted",)
    raw_id_fields = ("playlist", "version")
    list_select_related = ("playlist", "version")
    ordering = ("playlist", "position")
