from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Project


@admin.register(Project)
class ProjectAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "code",
        "name",
        "type",
        "status",
        "start_date",
        "delivery_date",
    )

    list_filter = (
        "type",
        "status",
    )

    search_fields = (
        "code",
        "name",
        "client_name",
    )

    autocomplete_fields = (
        "supervisor",
        "coordinator",
    )

    list_select_related = ()

    ordering = ("name",)
