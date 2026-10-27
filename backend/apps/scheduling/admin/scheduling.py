from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.scheduling.models import (
    CalendarEvent,
    Holiday,
    Milestone,
    Resource,
    ResourceLeave,
    ResourceSchedule,
    WorkCalendar,
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


class ViewOnlyMixin:
    """
    Calendars and milestones are written through their services (one default calendar, one calendar
    per office, project scoping, who completed a milestone), which the admin would bypass. Read them
    here; change them through the API.
    """

    def has_add_permission(self, request, *args, **kwargs):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(WorkCalendar)
class WorkCalendarAdmin(ViewOnlyMixin, PlatformScopedModelAdmin):
    list_display = ("code", "name", "time_zone", "office", "hours_per_day", "is_default")
    list_filter = ("is_default",)
    search_fields = ("code", "name")
    list_select_related = ("office",)
    ordering = ("name",)


@admin.register(Milestone)
class MilestoneAdmin(ViewOnlyMixin, PlatformScopedModelAdmin):
    list_display = ("name", "project", "due_date", "status", "kind")
    list_filter = ("status", "kind")
    search_fields = ("name",)
    list_select_related = ("project",)
    ordering = ("project", "order", "due_date")
