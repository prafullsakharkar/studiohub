"""
Scheduling serializers.
"""
from typing import Any

from rest_framework import serializers

from apps.scheduling.models import CalendarEvent, Holiday, Resource, ResourceLeave, ResourceSchedule
from apps.scheduling.selectors import ResourceLeaveSelector, ResourceSelector
from apps.scheduling.selectors.scope import RESTRICTED_TITLE, ViewerScope
from apps.scheduling.services.leave import count_leave_days


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
    
    title = serializers.CharField(required=True, max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    start_time = serializers.DateTimeField(required=True)
    end_time = serializers.DateTimeField(required=True)
    event_type = serializers.ChoiceField(
        choices=[
            "Meeting", "Deadline", "Milestone", "Review Session",
            "Holiday", "Leave", "Work Block"
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
    start_time = serializers.DateTimeField(required=False)
    end_time = serializers.DateTimeField(required=False)
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
    resource_type_display = serializers.CharField(source="get_resource_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    
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
    resource_type_display = serializers.CharField(source="get_resource_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    
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
    capacity_hours_per_week = serializers.IntegerField(required=False, default=40)
    hourly_rate_usd = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        default="0.00",
    )
    location = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def create(self, validated_data):
        from apps.identity.models import User
        from apps.masterdata.models import Department, Team

        department_id = validated_data.pop("department_id", None)
        team_id = validated_data.pop("team_id", None)
        user_id = validated_data.pop("user_id", None)

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
    capacity_hours_per_week = serializers.IntegerField(required=False)
    hourly_rate_usd = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
    )
    location = serializers.CharField(required=False, allow_blank=True, max_length=255)


class ResourceScheduleSerializer(serializers.ModelSerializer[Any]):
    """Serializer for resource schedule."""
    
    resource_name = serializers.CharField(source="resource.name", read_only=True)
    resource_code = serializers.CharField(source="resource.code", read_only=True)
    event_title = serializers.CharField(source="event.title", read_only=True)
    task_title = serializers.CharField(source="task.title", read_only=True)
    
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
            raise serializers.ValidationError(
                {"status": ["Only a pending leave can be changed."]}
            )
        start = attrs.get("start_date", getattr(instance, "start_date", None))
        end = attrs.get("end_date", getattr(instance, "end_date", None))
        if start is not None and end is not None:
            if end < start:
                raise serializers.ValidationError(
                    {"end_date": ["The end date cannot be before the start date."]}
                )
            days = count_leave_days(start, end)
            sent = self.initial_data.get("total_days") if hasattr(self, "initial_data") else None
            if sent not in (None, "", 0, "0") and str(sent) != str(days):
                raise serializers.ValidationError(
                    {"total_days": [f"Cannot be set directly. It is {days} for these dates."]}
                )
            attrs["total_days"] = days
        return attrs

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
    """Serializer for holiday."""
    
    class Meta:
        model = Holiday
        fields = (
            "id",
            "name",
            "holiday_date",
            "is_paid",
            "is_optional",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
