from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Shot


@admin.register(Shot)
class ShotAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "sequence_code",
        "project",
        "status",
        "supervisor_approved",
        "client_approved",
        "current_version",
    )

    list_filter = (
        "status",
        "supervisor_approved",
        "client_approved",
        "organization",
    )

    search_fields = (
        "code",
        "name",
        "sequence_code",
    )

    autocomplete_fields = ("project", "organization", "assigned_artist")

    list_select_related = ("project", "organization")

    ordering = ("code",)
