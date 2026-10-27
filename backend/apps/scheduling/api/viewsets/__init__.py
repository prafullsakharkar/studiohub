"""
Scheduling viewsets for API endpoints.
"""

from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.viewsets.platform_crud import PlatformCrudViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.scheduling.api.serializers import (
    BlockResourceSerializer,
    BookResourceSerializer,
    CalendarEventCreateSerializer,
    CalendarEventDetailSerializer,
    CalendarEventListSerializer,
    CalendarEventUpdateSerializer,
    HolidaySerializer,
    MilestoneSerializer,
    MilestoneWriteSerializer,
    ResourceCreateSerializer,
    ResourceDetailSerializer,
    ResourceLeaveSerializer,
    ResourceListSerializer,
    ResourceScheduleSerializer,
    ResourceUpdateSerializer,
    WorkCalendarSerializer,
    WorkCalendarWriteSerializer,
)
from apps.scheduling.constants.permissions import SchedulingPermissions
from apps.scheduling.models import Resource
from apps.scheduling.selectors import (
    CalendarEventSelector,
    HolidaySelector,
    MilestoneSelector,
    ResourceLeaveSelector,
    ResourceScheduleSelector,
    ResourceSelector,
    WorkCalendarSelector,
)
from apps.scheduling.selectors.scope import ViewerScope
from apps.scheduling.services import (
    approve_leave,
    reject_leave,
    update_calendar_event_status,
    working_leave_days,
)
from apps.scheduling.services.booking import BookingService
from apps.scheduling.services.calendar import WorkCalendarService
from apps.scheduling.services.milestone import MilestoneService

_NO_USER_RESOURCE_ERROR = "No scheduling resource is associated with the current user."


class CalendarEventViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for CalendarEvent."""

    selector_class = CalendarEventSelector
    # Frontend contract: bare-array lists.
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": CalendarEventListSerializer,
        "retrieve": CalendarEventDetailSerializer,
        "create": CalendarEventCreateSerializer,
        "update": CalendarEventUpdateSerializer,
        "partial_update": CalendarEventUpdateSerializer,
    }

    permission_map = {
        "list": (SchedulingPermissions.VIEW,),
        "retrieve": (SchedulingPermissions.VIEW,),
        "create": (SchedulingPermissions.CREATE,),
        "update": (SchedulingPermissions.UPDATE,),
        "partial_update": (SchedulingPermissions.UPDATE,),
        "destroy": (SchedulingPermissions.DELETE,),
        "update_status": (SchedulingPermissions.UPDATE,),
    }

    search_fields = ("title", "description", "location")
    ordering_fields = ("start_time", "end_time", "created_at")

    @action(detail=True, methods=["post"], url_path="update-status")
    def update_status(self, request, *args, **kwargs):
        """Update event status."""
        event = self.get_object()
        status_val = request.data.get("status")
        if not status_val:
            return Response({"detail": "status is required."}, status=400)

        event = update_calendar_event_status(
            event_id=str(event.id),
            status=status_val,
            user_id=str(request.user.id) if request.user.is_authenticated else None,
        )

        return Response(CalendarEventDetailSerializer(event).data)


class ResourceViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for Resource."""

    selector_class = ResourceSelector
    # Frontend contract: bare-array lists.
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": ResourceListSerializer,
        "retrieve": ResourceDetailSerializer,
        "create": ResourceCreateSerializer,
        "update": ResourceUpdateSerializer,
        "partial_update": ResourceUpdateSerializer,
    }

    permission_map = {
        "list": (SchedulingPermissions.VIEW,),
        "retrieve": (SchedulingPermissions.VIEW,),
        "create": (SchedulingPermissions.CREATE,),
        "update": (SchedulingPermissions.UPDATE,),
        "partial_update": (SchedulingPermissions.UPDATE,),
        "destroy": (SchedulingPermissions.DELETE,),
        "book": (SchedulingPermissions.UPDATE,),
        "block": (SchedulingPermissions.UPDATE,),
    }

    search_fields = ("name", "code", "location")
    ordering_fields = ("name", "capacity_hours_per_week", "hourly_rate_usd")

    @action(detail=True, methods=["post"], url_path="book")
    def book(self, request, *args, **kwargs):
        """Book the resource for a time slot."""
        resource = self.get_object()
        body = BookResourceSerializer(data=request.data, context=self.get_serializer_context())
        body.is_valid(raise_exception=True)
        data = body.validated_data

        schedule = BookingService.book(
            actor=request.user,
            resource=resource,
            start=data["start_time"],
            end=data["end_time"],
            status=data["status"],
            event=data.get("event"),
            task=data.get("task"),
            notes=data["notes"],
            viewer=ViewerScope.of(request),
        )

        return Response(
            ResourceScheduleSerializer(schedule, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="block")
    def block(self, request, *args, **kwargs):
        """Block the resource (mark as unavailable)."""
        resource = self.get_object()
        body = BlockResourceSerializer(data=request.data, context=self.get_serializer_context())
        body.is_valid(raise_exception=True)
        data = body.validated_data

        schedule = BookingService.book(
            actor=request.user,
            resource=resource,
            start=data["start_time"],
            end=data["end_time"],
            status="Blocked",
            notes=data["reason"],
            viewer=ViewerScope.of(request),
        )

        return Response(
            ResourceScheduleSerializer(schedule, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )


class ResourceScheduleViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for ResourceSchedule."""

    selector_class = ResourceScheduleSelector
    # Frontend contract: bare-array lists.
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": ResourceScheduleSerializer,
        "retrieve": ResourceScheduleSerializer,
        "create": ResourceScheduleSerializer,
        "update": ResourceScheduleSerializer,
        "partial_update": ResourceScheduleSerializer,
    }

    permission_map = {
        "list": (SchedulingPermissions.VIEW,),
        "retrieve": (SchedulingPermissions.VIEW,),
        "create": (SchedulingPermissions.CREATE,),
        "update": (SchedulingPermissions.UPDATE,),
        "partial_update": (SchedulingPermissions.UPDATE,),
        "destroy": (SchedulingPermissions.DELETE,),
    }

    search_fields = ("notes",)
    ordering_fields = ("start_time", "end_time", "created_at")

    def perform_create(self, serializer):
        data = serializer.validated_data
        serializer.instance = BookingService.book(
            actor=self.request.user,
            resource=data["resource"],
            start=data["start_time"],
            end=data["end_time"],
            status=data.get("status", "Available"),
            event=data.get("event"),
            task=data.get("task"),
            notes=data.get("notes", ""),
            viewer=ViewerScope.of(self.request),
        )

    def perform_update(self, serializer):
        booking = serializer.instance
        assert booking is not None  # an update always has the row it changes
        serializer.instance = BookingService.update(
            actor=self.request.user,
            booking=booking,
            data=serializer.validated_data,
            viewer=ViewerScope.of(self.request),
        )


class ResourceLeaveViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for ResourceLeave."""

    selector_class = ResourceLeaveSelector
    # Frontend contract: bare-array lists.
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": ResourceLeaveSerializer,
        "retrieve": ResourceLeaveSerializer,
        "create": ResourceLeaveSerializer,
        "update": ResourceLeaveSerializer,
        "partial_update": ResourceLeaveSerializer,
    }

    permission_map = {
        "list": (SchedulingPermissions.VIEW,),
        "retrieve": (SchedulingPermissions.VIEW,),
        "create": (SchedulingPermissions.CREATE,),
        "update": (SchedulingPermissions.UPDATE,),
        "partial_update": (SchedulingPermissions.UPDATE,),
        "destroy": (SchedulingPermissions.DELETE,),
        "approve": (SchedulingPermissions.UPDATE,),
        "reject": (SchedulingPermissions.UPDATE,),
    }

    search_fields = ("reason",)
    ordering_fields = ("start_date", "created_at")

    def perform_create(self, serializer):
        resource = serializer.validated_data.get("resource")
        if resource is None:
            resource = Resource.objects.filter(
                user=self.request.user,
            ).first()
        if resource is None:
            raise ValidationError({"resource": _NO_USER_RESOURCE_ERROR})
        data = serializer.validated_data
        # Working days of the calendar this resource follows (the serializer may not have known it)
        serializer.save(
            resource=resource,
            total_days=working_leave_days(resource, data["start_date"], data["end_date"]),
        )

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        """Approve a pending leave request (not your own; D-20)."""
        leave = self.get_object()

        leave = approve_leave(leave_id=str(leave.id), actor=request.user)

        return Response(ResourceLeaveSerializer(leave, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        """Reject a pending leave request with a reason (not your own; D-20)."""
        leave = self.get_object()

        leave = reject_leave(
            leave_id=str(leave.id),
            actor=request.user,
            rejection_reason=request.data.get("rejection_reason", ""),
        )

        return Response(ResourceLeaveSerializer(leave, context=self.get_serializer_context()).data)


class HolidayViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for Holiday."""

    selector_class = HolidaySelector
    # Frontend contract: bare-array lists.
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": HolidaySerializer,
        "retrieve": HolidaySerializer,
        "create": HolidaySerializer,
        "update": HolidaySerializer,
        "partial_update": HolidaySerializer,
    }

    permission_map = {
        "list": (SchedulingPermissions.VIEW,),
        "retrieve": (SchedulingPermissions.VIEW,),
        "create": (SchedulingPermissions.CREATE,),
        "update": (SchedulingPermissions.UPDATE,),
        "partial_update": (SchedulingPermissions.UPDATE,),
        "destroy": (SchedulingPermissions.DELETE,),
    }

    search_fields = ("name", "description")
    ordering_fields = ("holiday_date", "created_at")


class WorkCalendarViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Work calendars (studio-wide): time zone, working week, hours per day, one default.

    Writes need ``schedule.update`` for now; ``schedule.manage`` takes over with the roles in
    Phase 11. A calendar that is the default, or that a resource or holiday uses, is not deleted.
    """

    selector_class = WorkCalendarSelector
    # Frontend contract: bare-array lists.
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": WorkCalendarSerializer,
        "retrieve": WorkCalendarSerializer,
        "create": WorkCalendarWriteSerializer,
        "update": WorkCalendarWriteSerializer,
        "partial_update": WorkCalendarWriteSerializer,
    }

    permission_map = {
        "list": (SchedulingPermissions.VIEW,),
        "retrieve": (SchedulingPermissions.VIEW,),
        "create": (SchedulingPermissions.UPDATE,),
        "update": (SchedulingPermissions.UPDATE,),
        "partial_update": (SchedulingPermissions.UPDATE,),
        "destroy": (SchedulingPermissions.DELETE,),
        "set_default": (SchedulingPermissions.UPDATE,),
    }

    search_fields = ("code", "name")
    ordering_fields = ("name", "code", "created_at")

    @action(detail=True, methods=["post"], url_path="set-default")
    def set_default(self, request, *args, **kwargs):
        """Make this calendar the default; the previous default stops being one."""
        calendar = WorkCalendarService.set_default(actor=request.user, calendar=self.get_object())
        return Response(
            WorkCalendarSerializer(calendar, context=self.get_serializer_context()).data
        )

    def perform_destroy(self, instance):
        WorkCalendarService.delete(actor=self.request.user, calendar=instance)


class MilestoneViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Project milestones, narrowed to the caller's projects (another project's id is a 404).

    Writes follow the schedule codes for now; ``schedule.manage`` takes over in Phase 11.
    """

    selector_class = MilestoneSelector
    # Frontend contract: bare-array lists.
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": MilestoneSerializer,
        "retrieve": MilestoneSerializer,
        "create": MilestoneWriteSerializer,
        "update": MilestoneWriteSerializer,
        "partial_update": MilestoneWriteSerializer,
    }

    permission_map = {
        "list": (SchedulingPermissions.VIEW,),
        "retrieve": (SchedulingPermissions.VIEW,),
        "create": (SchedulingPermissions.CREATE,),
        "update": (SchedulingPermissions.UPDATE,),
        "partial_update": (SchedulingPermissions.UPDATE,),
        "destroy": (SchedulingPermissions.DELETE,),
        "complete": (SchedulingPermissions.UPDATE,),
        "reopen": (SchedulingPermissions.UPDATE,),
    }

    search_fields = ("name",)
    ordering_fields = ("due_date", "order", "name", "created_at")

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, *args, **kwargs):
        """Mark the milestone completed, recording who and when."""
        milestone = MilestoneService.complete(actor=request.user, milestone=self.get_object())
        return Response(MilestoneSerializer(milestone, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, *args, **kwargs):
        """Take a completed milestone back to In Progress."""
        milestone = MilestoneService.reopen(actor=request.user, milestone=self.get_object())
        return Response(MilestoneSerializer(milestone, context=self.get_serializer_context()).data)
