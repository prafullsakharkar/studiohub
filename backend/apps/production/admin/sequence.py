from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Sequence


@admin.register(Sequence)
class SequenceAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "organization",
        "status",
        "department",
        "frame_in",
        "frame_out",
    )

    list_filter = (
        "status",
        "department",
        "organization",
    )

    search_fields = (
        "code",
        "name",
    )

    autocomplete_fields = ("project", "organization")

    list_select_related = ("project", "organization")

    ordering = ("code",)
