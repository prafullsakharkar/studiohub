from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Task


@admin.register(Task)
class TaskAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "code",
        "title",
        "project",
        "entity_type",
        "entity_code",
        "status",
        "priority",
        "due_date",
        "is_archived",
    )

    list_filter = (
        "status",
        "priority",
        "department",
        "is_archived",
    )

    search_fields = (
        "code",
        "title",
        "entity_code",
        "entity_name",
    )

    autocomplete_fields = (
        "project",
        "assignee",
        "reviewer",
    )

    list_select_related = ("project",)

    date_hierarchy = "due_date"

    ordering = ("-created_at",)
