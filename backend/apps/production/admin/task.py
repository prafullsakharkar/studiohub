from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Task


@admin.register(Task)
class TaskAdmin(OrganizationScopedModelAdmin):
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
        "organization",
    )

    search_fields = (
        "code",
        "title",
        "entity_code",
        "entity_name",
    )

    autocomplete_fields = (
        "project",
        "organization",
        "team",
        "assignee",
        "reviewer",
    )

    list_select_related = ("project", "organization")

    date_hierarchy = "due_date"

    ordering = ("-created_at",)
