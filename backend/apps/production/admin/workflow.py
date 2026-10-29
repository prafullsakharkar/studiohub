from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import Workflow


@admin.register(Workflow)
class WorkflowAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "category",
        "is_active",
        "is_deleted",
    )

    list_filter = (
        "category",
        "is_active",
        "is_deleted",
    )

    search_fields = (
        "code",
        "name",
    )

    autocomplete_fields = ("project",)

    list_select_related = ("project",)

    ordering = ("name",)
