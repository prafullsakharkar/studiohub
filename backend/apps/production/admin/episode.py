from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Episode


@admin.register(Episode)
class EpisodeAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "status",
        "season_number",
        "episode_number",
        "air_date",
        "delivery_date",
    )

    list_filter = ("status",)

    search_fields = ("code", "name")

    autocomplete_fields = ("project",)

    list_select_related = ("project",)

    ordering = ("project", "season_number", "episode_number", "code")
