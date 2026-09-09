from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Workflow


@admin.register(Workflow)
class WorkflowAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "category",
        "is_active",
        "is_archived",
    )

    list_filter = (
        "category",
        "is_active",
        "is_archived",
        "organization",
    )

    search_fields = (
        "code",
        "name",
    )

    autocomplete_fields = ("project", "organization")

    list_select_related = ("project", "organization")

    ordering = ("name",)
