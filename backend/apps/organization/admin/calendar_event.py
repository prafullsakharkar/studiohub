from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import CalendarEvent


@admin.register(CalendarEvent)
class CalendarEventAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "date",
        "event_type",
        "office_name",
        "all_day",
        "created_at",
    )

    list_filter = (
        "event_type",
        "all_day",
    )
