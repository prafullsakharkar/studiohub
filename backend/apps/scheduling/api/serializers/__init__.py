"""
Scheduling serializers.
"""

import uuid
from typing import Any

from rest_framework import serializers

from apps.scheduling.api.fields import StrictDateTimeField
from apps.scheduling.models import (
    CalendarEvent,
    Holiday,
    Milestone,
    Resource,
    ResourceLeave,
    ResourceSchedule,
    WorkCalendar,
)
from apps.scheduling.selectors import ResourceLeaveSelector, ResourceSelector
from apps.scheduling.selectors.scope import RESTRICTED_TITLE, ViewerScope
from apps.scheduling.services.leave import working_leave_days


class ScopedLinkField(serializers.PrimaryKeyRelatedField):  # pyright: ignore[reportMissingTypeArgument]
    """
    A reference to an event or task the caller may see (D-22).

    An unknown id, a malformed one and one outside the caller's scope all fail with the
    same message, so the answer reveals nothing about records the caller cannot see.
    """

    default_error_messages = {
        "does_not_exist": "Unknown {noun}.",
        "incorrect_type": "Unknown {noun}.",
    }

    def __init__(self, *, noun: str, scope_kind: str, **kwargs):
        self._noun = noun
        self._scope_kind = scope_kind
        super().__init__(**kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        assert queryset is not None  # declared with a queryset
        scope = ViewerScope.of(self.context.get("request"))
        if self._scope_kind == "event":
            return scope.filter_events(queryset)
        return scope.filter_tasks(queryset)

    def to_internal_value(self, data):
        # A malformed id gets the same answer as an unknown one, not Django's own message.
        try:
            uuid.UUID(str(data))
        except ValueError:
            self.fail("incorrect_type")
        return super().to_internal_value(data)

    def fail(self, key, **kwargs):
        kwargs.setdefault("noun", self._noun)
        super().fail(key, **kwargs)


def _event_link(**extra):
    return ScopedLinkField(
        noun="event",
        scope_kind="event",
        queryset=CalendarEvent.objects.all(),
        required=False,
        allow_null=True,
        **extra,
    )


def _task_link(**extra):
    task_model = ResourceSchedule._meta.get_field("task").related_model
    return ScopedLinkField(
        noun="task",
        scope_kind="task",
        queryset=task_model._default_manager.all(),  # pyright: ignore[reportOptionalMemberAccess]
        required=False,
        allow_null=True,
        **extra,
    )


def _ensure_end_after_start(start, end, *, field="end_time", strict=False):
    """
    The end is not before the start. ``strict`` (bookings) also refuses an end equal to the start:
    a booking needs a duration, and the database check says so too.
    """
    if start is None or end is None:
        return
    if end < start:
        raise serializers.ValidationError({field: ["The end cannot be before the start."]})
    if strict and end == start:
        raise serializers.ValidationError({field: ["The end must be after the start."]})


def _ensure_known(model, value, noun):
    if value is not None and not model.objects.filter(pk=value).exists():
        raise serializers.ValidationError(f"Unknown {noun}.")
    return value


class CalendarEventListSerializer(serializers.ModelSerializer[Any]):
    """Serializer for calendar event list view."""

    project_name = serializers.CharField(source="project.name", read_only=True)
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    visibility_display = serializers.CharField(source="get_visibility_display", read_only=True)

    class Meta:
        model = CalendarEvent
        fields = (
            "id",
            "title",
            "description",
            "event_type",
            "event_type_display",
            "status",
            "status_display",
            "visibility",
            "visibility_display",
            "start_time",
            "end_time",
            "is_all_day",
            "location",
            "meeting_url",
            "project_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class CalendarEventDetailSerializer(serializers.ModelSerializer[Any]):
    """Serializer for calendar event detail view."""

    project = serializers.UUIDField(source="project.id", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    visibility_display = serializers.CharField(source="get_visibility_display", read_only=True)

    class Meta:
        model = CalendarEvent
        fields = (
            "id",
            "title",
            "description",
            "event_type",
            "event_type_display",
            "status",
            "status_display",
            "visibility",
            "visibility_display",
            "start_time",
            "end_time",
            "is_all_day",
            "location",
            "meeting_url",
            "notes",
            "metadata",
            "project",
            "project_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class CalendarEventCreateSerializer(serializers.Serializer[Any]):
    """Serializer for creating a calendar event."""

    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(required=True, max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    start_time = StrictDateTimeField(required=True)
    end_time = StrictDateTimeField(required=True)
    event_type = serializers.ChoiceField(
        choices=[
            "Meeting",
            "Deadline",
            "Milestone",
            "Review Session",
            "Holiday",
            "Leave",
            "Work Block",
        ],
        default="Meeting",
    )
    status = serializers.ChoiceField(
        choices=["Scheduled", "In Progress", "Completed", "Cancelled", "Postponed"],
        default="Scheduled",
    )
    visibility = serializers.ChoiceField(
        choices=["Private", "Team", "Organization", "Public"],
        default="Team",
    )
    project_id = serializers.UUIDField(required=False, allow_null=True)
    location = serializers.CharField(required=False, allow_blank=True, max_length=255)
    meeting_url = serializers.URLField(required=False, allow_blank=True)
    is_all_day = serializers.BooleanField(required=False, default=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_project_id(self, value):
        """A project the caller belongs to (any project for platform admins); else 'Unknown'."""
        if value is None:
            return value
        from apps.production.models import Project

        scope = ViewerScope.of(self.context.get("request"))
        if (
            not (scope.is_admin or value in scope.project_ids)
            or not Project.objects.filter(pk=value).exists()
        ):
            raise serializers.ValidationError("Unknown project.")
        return value

    def validate(self, attrs):
        _ensure_end_after_start(attrs.get("start_time"), attrs.get("end_time"))
        return attrs

    def create(self, validated_data):
        project_id = validated_data.pop("project_id", None)

        if project_id:
            from apps.production.models import Project

            validated_data["project"] = Project.objects.filter(pk=project_id).first()

        return CalendarEvent.objects.create(**validated_data)


class CalendarEventUpdateSerializer(serializers.Serializer[Any]):
    """Serializer for updating a calendar event."""

    title = serializers.CharField(required=False, max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    start_time = StrictDateTimeField(required=False)
    end_time = StrictDateTimeField(required=False)
    status = serializers.ChoiceField(
        choices=["Scheduled", "In Progress", "Completed", "Cancelled", "Postponed"],
        required=False,
    )
    visibility = serializers.ChoiceField(
        choices=["Private", "Team", "Organization", "Public"],
        required=False,
    )
    location = serializers.CharField(required=False, allow_blank=True, max_length=255)
    meeting_url = serializers.URLField(required=False, allow_blank=True)
    is_all_day = serializers.BooleanField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        event = self.instance
        _ensure_end_after_start(
            attrs.get("start_time", getattr(event, "start_time", None)),
            attrs.get("end_time", getattr(event, "end_time", None)),
        )
        return attrs

    def update(self, instance, validated_data):
        from apps.scheduling.services import update_calendar_event

        return update_calendar_event(event=instance, data=validated_data)

    def to_representation(self, instance):
        return CalendarEventDetailSerializer(instance, context=self.context).data


class ResourceRatesMixin(serializers.Serializer[Any]):
    """
    Pay rate and e-mail of a resource are shown to holders of ``schedule.view_rates`` and to
    the person the resource is; everyone else gets null and "" (D-21).
    """

    _rates_holder: bool | None = None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = getattr(self.context.get("request"), "user", None)
        if self._rates_holder is None:  # once per request: the child serializer serves every row
            self._rates_holder = ResourceSelector.holds_rates_code(user)
        if not ResourceSelector.can_see_rates(user, instance, holder=self._rates_holder):
            data["hourly_rate_usd"] = None
            data["user_email"] = ""
        return data


class ResourceListSerializer(ResourceRatesMixin, serializers.ModelSerializer[Any]):  # pyright: ignore[reportUnsafeMultipleInheritance]
    """Serializer for resource list view."""

    department_name = serializers.CharField(source="department.name", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    resource_type_display = serializers.CharField(
        source="get_resource_type_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    calendar = serializers.UUIDField(source="calendar_id", read_only=True)
    calendar_name = serializers.CharField(source="calendar.name", read_only=True, default="")

    class Meta:
        model = Resource
        fields = (
            "id",
            "name",
            "code",
            "resource_type",
            "resource_type_display",
            "status",
            "status_display",
            "department",
            "department_name",
            "team",
            "team_name",
            "user",
            "user_email",
            "calendar",
            "calendar_name",
            "capacity_hours_per_week",
            "hourly_rate_usd",
            "location",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ResourceDetailSerializer(ResourceRatesMixin, serializers.ModelSerializer[Any]):  # pyright: ignore[reportUnsafeMultipleInheritance]
    """Serializer for resource detail view."""

    department = serializers.UUIDField(source="department.id", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    team = serializers.UUIDField(source="team.id", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)
    user = serializers.UUIDField(source="user.id", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    resource_type_display = serializers.CharField(
        source="get_resource_type_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    calendar = serializers.UUIDField(source="calendar_id", read_only=True)
    calendar_name = serializers.CharField(source="calendar.name", read_only=True, default="")

    class Meta:
        model = Resource
        fields = (
            "id",
            "name",
            "code",
            "resource_type",
            "resource_type_display",
            "status",
            "status_display",
            "department",
            "department_name",
            "team",
            "team_name",
            "user",
            "user_email",
            "calendar",
            "calendar_name",
            "capacity_hours_per_week",
            "hourly_rate_usd",
            "location",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ResourceCreateSerializer(serializers.Serializer[Any]):
    """Serializer for creating a resource."""

    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(required=True, max_length=255)
    code = serializers.CharField(required=True, max_length=50)
    resource_type = serializers.ChoiceField(
        choices=["Person", "Equipment", "Room", "Studio"],
        default="Person",
    )
    status = serializers.ChoiceField(
        choices=["Active", "On Leave", "Unavailable"],
        default="Active",
    )
    department_id = serializers.UUIDField(required=False, allow_null=True)
    team_id = serializers.UUIDField(required=False, allow_null=True)
    user_id = serializers.UUIDField(required=False, allow_null=True)
    calendar_id = serializers.UUIDField(required=False, allow_null=True)
    capacity_hours_per_week = serializers.IntegerField(required=False, default=40, min_value=0)
    hourly_rate_usd = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        default="0.00",
        min_value=0,
    )
    location = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate_code(self, value):
        if Resource.all_objects.filter(code__iexact=value).exists():
            raise serializers.ValidationError("A resource with this code already exists.")
        return value

    def validate_user_id(self, value):
        from apps.identity.models import User

        return _ensure_known(User, value, "user")

    def validate_department_id(self, value):
        from apps.masterdata.models import Department

        return _ensure_known(Department, value, "department")

    def validate_team_id(self, value):
        from apps.masterdata.models import Team

        return _ensure_known(Team, value, "team")

    def validate_calendar_id(self, value):
        return _ensure_known(WorkCalendar, value, "calendar")

    def create(self, validated_data):
        from apps.identity.models import User
        from apps.masterdata.models import Department, Team

        department_id = validated_data.pop("department_id", None)
        team_id = validated_data.pop("team_id", None)
        user_id = validated_data.pop("user_id", None)
        calendar_id = validated_data.pop("calendar_id", None)
        if calendar_id:
            validated_data["calendar"] = WorkCalendar.objects.get(pk=calendar_id)

        if department_id:
            validated_data["department"] = Department.objects.filter(pk=department_id).first()
        if team_id:
            validated_data["team"] = Team.objects.filter(pk=team_id).first()
        if user_id:
            validated_data["user"] = User.objects.filter(pk=user_id).first()

        return Resource.objects.create(**validated_data)


class ResourceUpdateSerializer(serializers.Serializer[Any]):
    """Serializer for updating a resource."""

    name = serializers.CharField(required=False, max_length=255)
    status = serializers.ChoiceField(
        choices=["Active", "On Leave", "Unavailable"],
        required=False,
    )
    department_id = serializers.UUIDField(required=False, allow_null=True)
    team_id = serializers.UUIDField(required=False, allow_null=True)
    calendar_id = serializers.UUIDField(required=False, allow_null=True)
    capacity_hours_per_week = serializers.IntegerField(required=False, min_value=0)
    hourly_rate_usd = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    location = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate_department_id(self, value):
        from apps.masterdata.models import Department

        return _ensure_known(Department, value, "department")

    def validate_team_id(self, value):
        from apps.masterdata.models import Team

        return _ensure_known(Team, value, "team")

    def validate_calendar_id(self, value):
        return _ensure_known(WorkCalendar, value, "calendar")

    def update(self, instance, validated_data):
        from apps.masterdata.models import Department, Team

        if "calendar_id" in validated_data:
            calendar_id = validated_data.pop("calendar_id")
            instance.calendar = WorkCalendar.objects.get(pk=calendar_id) if calendar_id else None

        if "department_id" in validated_data:
            department_id = validated_data.pop("department_id")
            instance.department = (
                Department.objects.get(pk=department_id) if department_id else None
            )
        if "team_id" in validated_data:
            team_id = validated_data.pop("team_id")
            instance.team = Team.objects.get(pk=team_id) if team_id else None
        for name, value in validated_data.items():
            setattr(instance, name, value)
        instance.save()
        return instance

    def to_representation(self, instance):
        return ResourceDetailSerializer(instance, context=self.context).data


class ResourceScheduleSerializer(serializers.ModelSerializer[Any]):
    """Serializer for resource schedule."""

    resource_name = serializers.CharField(source="resource.name", read_only=True)
    resource_code = serializers.CharField(source="resource.code", read_only=True)
    event_title = serializers.CharField(source="event.title", read_only=True)
    task_title = serializers.CharField(source="task.title", read_only=True)
    event = _event_link()
    task = _task_link()
    start_time = StrictDateTimeField()
    end_time = StrictDateTimeField()

    class Meta:
        model = ResourceSchedule
        fields = (
            "id",
            "resource",
            "resource_name",
            "resource_code",
            "start_time",
            "end_time",
            "status",
            "event",
            "event_title",
            "task",
            "task_title",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    _scope: ViewerScope | None = None

    def validate(self, attrs):
        instance = self.instance
        _ensure_end_after_start(
            attrs.get("start_time", getattr(instance, "start_time", None)),
            attrs.get("end_time", getattr(instance, "end_time", None)),
            strict=True,
        )
        return attrs

    def to_representation(self, instance):
        """A booking tied to an event or task the caller may not see keeps its time slot but
        not the title, nor the notes (D-21)."""
        data = super().to_representation(instance)
        if self._scope is None:  # once per request
            self._scope = ViewerScope.of(self.context.get("request"))
        hidden = (instance.event_id is not None and not self._scope.sees_event(instance.event)) or (
            instance.task_id is not None and not self._scope.sees_task(instance.task)
        )
        if hidden:
            if instance.event_id is not None and not self._scope.sees_event(instance.event):
                data["event_title"] = RESTRICTED_TITLE
            if instance.task_id is not None and not self._scope.sees_task(instance.task):
                data["task_title"] = RESTRICTED_TITLE
            data["notes"] = ""
        return data


class ResourceLeaveSerializer(serializers.ModelSerializer[Any]):
    """
    Serializer for resource leave.

    A request starts Pending and is decided only through the approve and reject actions
    (D-20): status, the decision fields and ``total_days`` cannot be set directly (a 400
    unless the value sent is the one the server holds or computes), and a request can only
    be edited while Pending. The reasons are shown to the person it is for and to approvers.
    """

    LOCKED = {
        "status": "Use the approve and reject actions.",
        "approved_by": "Use the approve action.",
        "approved_at": "Use the approve action.",
        "rejected_by": "Use the reject action.",
        "rejected_at": "Use the reject action.",
        "rejection_reason": "Use the reject action.",
    }

    _approver: bool | None = None

    resource_name = serializers.CharField(source="resource.name", read_only=True)
    resource_code = serializers.CharField(source="resource.code", read_only=True)
    leave_type_display = serializers.CharField(source="get_leave_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.name", read_only=True)

    resource = serializers.PrimaryKeyRelatedField(
        queryset=Resource.objects.all(),
        required=False,
    )

    class Meta:
        model = ResourceLeave
        fields = (
            "id",
            "resource",
            "resource_name",
            "resource_code",
            "leave_type",
            "leave_type_display",
            "status",
            "status_display",
            "start_date",
            "end_date",
            "total_days",
            "reason",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "rejected_by",
            "rejected_at",
            "rejection_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "total_days",
            "approved_by",
            "approved_at",
            "rejected_by",
            "rejected_at",
            "rejection_reason",
            "created_at",
            "updated_at",
        )

    def to_internal_value(self, data):
        errors = {}
        for name, hint in self.LOCKED.items():
            if name in data and self._differs(name, data[name]):
                errors[name] = [f"Cannot be set directly. {hint}"]
        if errors:
            raise serializers.ValidationError(errors)
        return super().to_internal_value(data)

    def _differs(self, name, raw) -> bool:
        """Whether ``raw`` is something other than the value held now (or the default on create)."""
        field = self.fields[name]
        if self.instance is not None:
            value = getattr(self.instance, name)
            held = None if value is None else field.to_representation(value)
        else:
            held = ResourceLeave.STATUS_PENDING if name == "status" else None
        if raw in (None, "") and held in (None, ""):
            return False
        return str(raw) != str(held)

    def validate(self, attrs):
        instance = self.instance
        if instance is not None and instance.status != ResourceLeave.STATUS_PENDING:
            raise serializers.ValidationError({"status": ["Only a pending leave can be changed."]})
        start = attrs.get("start_date", getattr(instance, "start_date", None))
        end = attrs.get("end_date", getattr(instance, "end_date", None))
        if start is not None and end is not None:
            if end < start:
                raise serializers.ValidationError(
                    {"end_date": ["The end date cannot be before the start date."]}
                )
            attrs["total_days"] = days = self._days(attrs, instance, start, end)
            sent = self.initial_data.get("total_days") if hasattr(self, "initial_data") else None
            if sent not in (None, "", 0, "0") and str(sent) != str(days):
                raise serializers.ValidationError(
                    {"total_days": [f"Cannot be set directly. It is {days} for these dates."]}
                )
        return attrs

    @staticmethod
    def _days(attrs, instance, start, end) -> int:
        """
        Working days of the resource's calendar (decision Q20). A request already stored keeps its
        count while its dates stay the same: old rows were counted in calendar days and are not
        recomputed. A new request, or one whose dates change, is counted now.
        """
        if instance is not None and start == instance.start_date and end == instance.end_date:
            return instance.total_days
        resource = attrs.get("resource") or getattr(instance, "resource", None)
        return working_leave_days(resource, start, end)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if self._approver is None:  # once per request: the child serializer serves every row
            self._approver = ResourceLeaveSelector.is_approver(user)
        if not ResourceLeaveSelector.can_see_details(user, instance, approver=self._approver):
            data["reason"] = ""
            data["rejection_reason"] = ""
        return data


class HolidaySerializer(serializers.ModelSerializer[Any]):
    """
    Serializer for holiday.

    A holiday belongs to a work calendar: ``calendar_id`` chooses it and defaults to the default
    calendar, so clients that never knew about calendars keep working. A calendar has one live
    holiday per date.
    """

    calendar = serializers.UUIDField(source="calendar_id", read_only=True)
    calendar_name = serializers.CharField(source="calendar.name", read_only=True, default="")
    calendar_id = serializers.PrimaryKeyRelatedField(
        source="calendar",
        queryset=WorkCalendar.objects.all(),
        required=False,
        write_only=True,
        error_messages={
            "does_not_exist": "Unknown calendar.",
            "incorrect_type": "Unknown calendar.",
        },
    )

    class Meta:
        model = Holiday
        fields = (
            "id",
            "name",
            "holiday_date",
            "calendar",
            "calendar_name",
            "calendar_id",
            "is_paid",
            "is_optional",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        validators: list[Any] = []

    def validate(self, attrs):
        instance = self.instance
        calendar = attrs.get("calendar") or getattr(instance, "calendar", None)
        if calendar is None:
            from apps.scheduling.services.calendar import WorkCalendarService

            calendar = attrs["calendar"] = WorkCalendarService.ensure_default()
        day = attrs.get("holiday_date", getattr(instance, "holiday_date", None))
        clash = Holiday.objects.filter(calendar=calendar, holiday_date=day)
        if instance is not None:
            clash = clash.exclude(pk=instance.pk)
        if clash.exists():
            raise serializers.ValidationError(
                {"holiday_date": ["This calendar already has a holiday on this date."]}
            )
        return attrs


class WorkCalendarSerializer(serializers.ModelSerializer[Any]):
    """A work calendar as read."""

    office = serializers.UUIDField(source="office_id", read_only=True)
    office_name = serializers.CharField(source="office.name", read_only=True, default="")
    resource_count = serializers.SerializerMethodField()

    def get_resource_count(self, obj) -> int:
        return obj.resources.filter(is_deleted=False).count()

    class Meta:
        model = WorkCalendar
        fields = (
            "id",
            "code",
            "name",
            "time_zone",
            "office",
            "office_name",
            "working_weekdays",
            "hours_per_day",
            "is_default",
            "resource_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class WorkCalendarWriteSerializer(serializers.Serializer[Any]):
    """
    Body of a calendar create or edit. The rules (zone, weekdays, hours, the one default, one
    calendar per office) are the service's; the answer is the calendar as read.
    """

    code = serializers.CharField(required=False, max_length=50)
    name = serializers.CharField(required=False, max_length=255)
    time_zone = serializers.CharField(required=False, max_length=64)
    office_id = serializers.UUIDField(required=False, allow_null=True)
    working_weekdays = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=False
    )
    hours_per_day = serializers.DecimalField(
        max_digits=4, decimal_places=2, required=False, min_value=0, max_value=24
    )
    is_default = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if self.instance is None and not attrs.get("code"):
            raise serializers.ValidationError({"code": ["A code is required."]})
        if self.instance is not None and "code" in attrs:
            if attrs["code"] != self.instance.code:
                raise serializers.ValidationError({"code": ["The code cannot be changed."]})
            attrs.pop("code")
        if "office_id" in attrs:
            attrs["office"] = self._office(attrs.pop("office_id"))
        return attrs

    @staticmethod
    def _office(value):
        if value is None:
            return None
        from apps.masterdata.models import Office

        office = Office.objects.filter(pk=value).first()
        if office is None:
            raise serializers.ValidationError({"office_id": ["Unknown office."]})
        return office

    def _actor(self):
        return getattr(self.context.get("request"), "user", None)

    def create(self, validated_data):
        from apps.scheduling.services.calendar import WorkCalendarService

        return WorkCalendarService.create(actor=self._actor(), data=validated_data)

    def update(self, instance, validated_data):
        from apps.scheduling.services.calendar import WorkCalendarService

        return WorkCalendarService.update(
            actor=self._actor(), calendar=instance, data=validated_data
        )

    def to_representation(self, instance):
        return WorkCalendarSerializer(instance, context=self.context).data


class MilestoneSerializer(serializers.ModelSerializer[Any]):
    """A project milestone as read."""

    project = serializers.UUIDField(source="project_id", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    project_code = serializers.CharField(source="project.code", read_only=True)

    class Meta:
        model = Milestone
        fields = (
            "id",
            "project",
            "project_name",
            "project_code",
            "name",
            "due_date",
            "status",
            "order",
            "kind",
            "delivery_package_id",
            "notes",
            "completed_at",
            "completed_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class MilestoneWriteSerializer(serializers.Serializer[Any]):
    """
    Body of a milestone create or edit. The project is chosen on create (an id or a code, one the
    caller may use) and cannot change afterwards; ``status`` moves between Pending and In Progress
    (Completed has its own actions). The rules are the service's.
    """

    project_id = serializers.CharField(required=False, max_length=64)
    name = serializers.CharField(required=False, max_length=255)
    due_date = serializers.DateField(required=False)
    status = serializers.ChoiceField(
        choices=[value for value, _ in Milestone.STATUS_CHOICES], required=False
    )
    order = serializers.IntegerField(required=False, min_value=0)
    kind = serializers.ChoiceField(
        choices=[value for value, _ in Milestone.KIND_CHOICES], required=False
    )
    delivery_package_id = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if self.instance is None:
            missing = [name for name in ("project_id", "name", "due_date") if name not in attrs]
            if missing:
                raise serializers.ValidationError(
                    {name: ["This field is required."] for name in missing}
                )
            return attrs
        if "project_id" in attrs:
            if str(attrs["project_id"]) not in {
                str(self.instance.project_id),
                self.instance.project.code,
            }:
                raise serializers.ValidationError({"project_id": ["Cannot be changed."]})
            attrs.pop("project_id")
        return attrs

    def _actor(self):
        return getattr(self.context.get("request"), "user", None)

    def create(self, validated_data):
        from apps.production.selectors.project import ProjectSelector
        from apps.scheduling.services.milestone import MilestoneService

        request = self.context.get("request")
        project = ProjectSelector.resolve_visible(request, validated_data.pop("project_id"))
        if project is None:
            raise serializers.ValidationError({"project_id": ["Unknown project."]})
        return MilestoneService.create(actor=self._actor(), project=project, data=validated_data)

    def update(self, instance, validated_data):
        from apps.scheduling.services.milestone import MilestoneService

        return MilestoneService.update(actor=self._actor(), milestone=instance, data=validated_data)

    def to_representation(self, instance):
        return MilestoneSerializer(instance, context=self.context).data


class ResolveOverbookingSerializer(serializers.Serializer[Any]):
    """
    Body of ``POST /resolve-overbooking/``: the alert to triage, and optionally its resource.
    A key it does not declare is a 400, as it was when Production served this endpoint.
    """

    alert_id = serializers.CharField()
    resource_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError({"non_field_errors": ["Expected an object."]})
        unknown = sorted(set(data.keys()) - set(self.fields))
        if unknown:
            raise serializers.ValidationError({key: ["Unknown field."] for key in unknown})
        return super().to_internal_value(data)


class BookResourceSerializer(serializers.Serializer[Any]):
    """Body of ``POST /resources/{id}/book/``."""

    start_time = StrictDateTimeField()
    end_time = StrictDateTimeField()
    status = serializers.ChoiceField(
        choices=[value for value, _ in ResourceSchedule.STATUS_CHOICES], default="Booked"
    )
    event_id = _event_link(source="event")
    task_id = _task_link(source="task")
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        _ensure_end_after_start(attrs.get("start_time"), attrs.get("end_time"), strict=True)
        return attrs


class BlockResourceSerializer(serializers.Serializer[Any]):
    """Body of ``POST /resources/{id}/block/``."""

    start_time = StrictDateTimeField()
    end_time = StrictDateTimeField()
    reason = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        _ensure_end_after_start(attrs.get("start_time"), attrs.get("end_time"), strict=True)
        return attrs
