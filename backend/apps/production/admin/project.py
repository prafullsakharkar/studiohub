from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Project


@admin.register(Project)
class ProjectAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "organization",
        "type",
        "status",
        "start_date",
        "delivery_date",
    )

    list_filter = (
        "type",
        "status",
        "organization",
    )

    search_fields = (
        "code",
        "name",
        "client_name",
    )

    autocomplete_fields = (
        "organization",
        "supervisor",
        "coordinator",
    )

    list_select_related = ("organization",)

    ordering = ("name",)
