from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Review


@admin.register(Review)
class ReviewAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
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
    )

    search_fields = (
        "code",
        "title",
        "entity_code",
    )

    autocomplete_fields = ("project", "lead_reviewer")

    list_select_related = ("project",)

    ordering = ("-created_at",)
