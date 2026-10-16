from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.models import Timelog


@admin.register(Timelog)
class TimelogAdmin(StudioHubModelAdmin):
    list_display = (
        "task",
        "person",
        "project",
        "date",
        "duration_hours",
        "status",
        "billable",
    )

    list_filter = (
        "status",
        "billable",
        "department",
    )

    search_fields = (
        "task_code",
        "task_title",
        "project_code",
    )

    autocomplete_fields = (
        "task",
        "person",
        "project",
        "approved_by",
    )

    list_select_related = ("task", "person", "project")

    date_hierarchy = "date"

    ordering = ("-date",)
