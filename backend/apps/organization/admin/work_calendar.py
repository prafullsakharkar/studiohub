from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import WorkCalendar


@admin.register(WorkCalendar)
class WorkCalendarAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "organization",
        "timezone",
        "is_default",
        "created_at",
    )

    list_filter = (
        "is_default",
        "organization",
    )

    search_fields = (
        "name",
        "organization__name",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
