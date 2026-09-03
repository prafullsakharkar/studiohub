"""
Scheduling serializers.
"""
from rest_framework import serializers

from apps.organization.models import Organization
from apps.scheduling.models import CalendarEvent, Holiday, Resource, ResourceLeave, ResourceSchedule


class CalendarEventListSerializer(serializers.ModelSerializer):
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


class CalendarEventDetailSerializer(serializers.ModelSerializer):
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


class CalendarEventCreateSerializer(serializers.Serializer):
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


class CalendarEventUpdateSerializer(serializers.Serializer):
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


class ResourceListSerializer(serializers.ModelSerializer):
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


class ResourceDetailSerializer(serializers.ModelSerializer):
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


class ResourceCreateSerializer(serializers.Serializer):
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
        from apps.organization.models import Department, Team

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


class ResourceUpdateSerializer(serializers.Serializer):
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


class ResourceScheduleSerializer(serializers.ModelSerializer):
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


class ResourceLeaveSerializer(serializers.ModelSerializer):
    """Serializer for resource leave."""
    
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
            "rejection_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class HolidaySerializer(serializers.ModelSerializer):
    """Serializer for holiday."""
    
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = Holiday
        fields = (
            "id",
            "name",
            "organization",
            "holiday_date",
            "is_paid",
            "is_optional",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
