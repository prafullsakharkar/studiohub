from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import Review


@admin.register(Review)
class ReviewAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "title",
        "project",
        "entity_type",
        "entity_code",
        "status",
        "supervisor_verdict",
    )

    list_filter = (
        "status",
        "entity_type",
        "organization",
    )

    search_fields = (
        "code",
        "title",
        "entity_code",
    )

    autocomplete_fields = ("project", "organization", "lead_reviewer")

    list_select_related = ("project", "organization")

    ordering = ("-created_at",)
