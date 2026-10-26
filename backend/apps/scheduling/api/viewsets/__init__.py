"""
Scheduling viewsets for API endpoints.
"""
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions.base import IsAuthenticatedPermission
from apps.deliveries.api.viewsets.base import PlatformCrudViewSet
from apps.identity.permissions import HasPermission
from apps.scheduling.api.serializers import (
    BlockResourceSerializer,
    BookResourceSerializer,
    CalendarEventCreateSerializer,
    CalendarEventDetailSerializer,
    CalendarEventListSerializer,
    CalendarEventUpdateSerializer,
    HolidaySerializer,
    ResourceCreateSerializer,
    ResourceDetailSerializer,
    ResourceLeaveSerializer,
    ResourceListSerializer,
    ResourceScheduleSerializer,
    ResourceUpdateSerializer,
)
from apps.scheduling.constants.permissions import SchedulingPermissions
from apps.scheduling.models import Resource
from apps.scheduling.selectors import (
    CalendarEventSelector,
    HolidaySelector,
    ResourceLeaveSelector,
    ResourceScheduleSelector,
    ResourceSelector,
)
from apps.scheduling.services import (
    approve_leave,
    block_resource,
    book_resource,
    reject_leave,
    update_calendar_event_status,
)

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
        event, task = data.get("event"), data.get("task")

        schedule = book_resource(
            resource_id=str(resource.id),
            start_time=data["start_time"],
            end_time=data["end_time"],
            event_id=str(event.id) if event else None,
            task_id=str(task.id) if task else None,
            status=data["status"],
            notes=data["notes"],
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

        schedule = block_resource(
            resource_id=str(resource.id),
            start_time=data["start_time"],
            end_time=data["end_time"],
            reason=data["reason"],
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
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


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
        serializer.save(resource=resource)

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
