from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Sequence


@admin.register(Sequence)
class SequenceAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "status",
        "department",
        "frame_in",
        "frame_out",
    )

    list_filter = (
        "status",
        "department",
    )

    search_fields = (
        "code",
        "name",
    )

    autocomplete_fields = ("project",)

    list_select_related = ("project",)

    ordering = ("code",)
