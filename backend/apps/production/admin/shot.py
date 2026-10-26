from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Shot


@admin.register(Shot)
class ShotAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "code",
        "name",
        "sequence_code",
        "project",
        "status",
        "supervisor_approved",
        "client_approved",
    )

    list_filter = (
        "status",
        "supervisor_approved",
        "client_approved",
    )

    search_fields = (
        "code",
        "name",
        "sequence__code",
    )

    autocomplete_fields = ("project", "assigned_artist")

    list_select_related = ("project", "sequence")

    ordering = ("code",)
