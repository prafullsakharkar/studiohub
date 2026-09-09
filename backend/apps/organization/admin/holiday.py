from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import Holiday


@admin.register(Holiday)
class HolidayAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "date",
        "holiday_type",
        "is_paid",
        "is_recurring",
        "work_calendar",
        "created_at",
    )

    list_filter = (
        "holiday_type",
        "is_paid",
        "is_recurring",
        "work_calendar",
    )

    search_fields = (
        "name",
        "date",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
