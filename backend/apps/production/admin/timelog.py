from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Timelog


@admin.register(Timelog)
class TimelogAdmin(OrganizationScopedModelAdmin):
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
        "organization",
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
        "organization",
        "approved_by",
    )

    list_select_related = ("task", "person", "project", "organization")

    date_hierarchy = "date"

    ordering = ("-date",)
