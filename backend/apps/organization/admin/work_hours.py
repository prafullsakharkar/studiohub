from django.contrib import admin

from apps.organization.models import WorkHours


@admin.register(WorkHours)
class WorkHoursAdmin(admin.ModelAdmin):
    list_display = (
        "work_calendar",
        "day",
        "start_time",
        "end_time",
        "is_working_day",
        "created_at",
    )

    list_filter = (
        "is_working_day",
        "work_calendar",
    )

    search_fields = (
        "work_calendar__name",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
