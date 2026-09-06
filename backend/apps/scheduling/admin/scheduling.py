from django.contrib import admin

from apps.organization.admin.base import (
    OrganizationScopedAdminMixin,
    OrganizationScopedModelAdmin,
)
from apps.scheduling.models import (
    CalendarEvent,
    Holiday,
    Resource,
    ResourceLeave,
    ResourceSchedule,
)


@admin.register(Resource)
class ResourceAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "organization",
        "resource_type",
        "status",
        "capacity_hours_per_week",
    )

    list_filter = (
        "resource_type",
        "status",
        "organization",
    )

    search_fields = (
        "code",
        "name",
    )

    autocomplete_fields = ("organization", "department", "team", "user")

    list_select_related = ("organization",)

    ordering = ("name",)


@admin.register(CalendarEvent)
class CalendarEventAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "title",
        "organization",
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
        "organization",
    )

    search_fields = (
        "title",
        "location",
    )

    autocomplete_fields = ("organization", "project")

    list_select_related = ("organization", "project")

    date_hierarchy = "start_time"

    ordering = ("-start_time",)


@admin.register(Holiday)
class HolidayAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "organization",
        "holiday_date",
        "is_paid",
        "is_optional",
    )

    list_filter = (
        "is_paid",
        "is_optional",
        "organization",
    )

    search_fields = ("name",)

    autocomplete_fields = ("organization",)

    list_select_related = ("organization",)

    date_hierarchy = "holiday_date"

    ordering = ("holiday_date",)


@admin.register(ResourceLeave)
class ResourceLeaveAdmin(OrganizationScopedAdminMixin, admin.ModelAdmin):
    organization_lookup = "resource__organization"

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
class ResourceScheduleAdmin(OrganizationScopedAdminMixin, admin.ModelAdmin):
    organization_lookup = "resource__organization"

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
