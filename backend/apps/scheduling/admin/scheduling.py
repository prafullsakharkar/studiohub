from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.scheduling.models import (
    CalendarEvent,
    Holiday,
    Resource,
    ResourceLeave,
    ResourceSchedule,
)


@admin.register(Resource)
class ResourceAdmin(PlatformScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "resource_type",
        "status",
        "capacity_hours_per_week",
    )

    list_filter = (
        "resource_type",
        "status",
    )

    search_fields = (
        "code",
        "name",
    )



    list_select_related = ()

    ordering = ("name",)


@admin.register(CalendarEvent)
class CalendarEventAdmin(PlatformScopedModelAdmin):
    list_display = (
        "title",
        "project",
        "event_type",
        "status",
        "start_time",
        "end_time",
        "is_all_day",
    )

    list_filter = (
        "event_type",
        "status",
        "visibility",
        "is_all_day",
    )

    search_fields = (
        "title",
        "location",
    )

    autocomplete_fields = ("project",)

    list_select_related = ("project",)

    date_hierarchy = "start_time"

    ordering = ("-start_time",)


@admin.register(Holiday)
class HolidayAdmin(PlatformScopedModelAdmin):
    list_display = (
        "name",
        "holiday_date",
        "is_paid",
        "is_optional",
    )

    list_filter = (
        "is_paid",
        "is_optional",
    )

    search_fields = ("name",)



    list_select_related = ()

    date_hierarchy = "holiday_date"

    ordering = ("holiday_date",)


@admin.register(ResourceLeave)
class ResourceLeaveAdmin(PlatformScopedModelAdmin):
    list_display = (
        "resource",
        "leave_type",
        "status",
        "start_date",
        "end_date",
        "total_days",
    )

    list_filter = (
        "leave_type",
        "status",
    )

    search_fields = ("resource__name", "resource__code")

    autocomplete_fields = ("resource", "approved_by")

    list_select_related = ("resource",)

    date_hierarchy = "start_date"

    ordering = ("-start_date",)


@admin.register(ResourceSchedule)
class ResourceScheduleAdmin(PlatformScopedModelAdmin):
    list_display = (
        "resource",
        "start_time",
        "end_time",
        "status",
    )

    list_filter = ("status",)

    search_fields = ("resource__name", "resource__code")

    autocomplete_fields = ("resource", "event", "task")

    list_select_related = ("resource",)

    date_hierarchy = "start_time"

    ordering = ("-start_time",)
