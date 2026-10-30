"""
Scheduling viewsets for API endpoints.
"""

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response

from apps.core.api.viewsets.platform_crud import PlatformCrudViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.scheduling.api.filters import RatesOrderingFilter
from apps.scheduling.api.filtersets import (
    BookingFilterSet,
    EventFilterSet,
    LeaveFilterSet,
    MilestoneFilterSet,
    ResourceFilterSet,
)
from apps.scheduling.api.serializers import (
    BlockResourceSerializer,
    BookingBulkDeleteResponseSerializer,
    BookingBulkDeleteSerializer,
    BookResourceSerializer,
    CalendarEventCreateSerializer,
    CalendarEventDetailSerializer,
    CalendarEventListSerializer,
    CalendarEventUpdateSerializer,
    EventStatusSerializer,
    HolidaySerializer,
    LeaveDecisionSerializer,
    LeaveRejectSerializer,
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
from apps.scheduling.services import update_calendar_event_status
from apps.scheduling.services.access import can_decide_own_leave, can_manage
from apps.scheduling.services.booking import BookingService
from apps.scheduling.services.calendar import WorkCalendarService
from apps.scheduling.services.leave import approve_leave, create_leave, reject_leave, update_leave
from apps.scheduling.services.milestone import MilestoneService


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

    filterset_class = EventFilterSet
    search_fields = ("title", "description", "location")
    ordering_fields = ("start_time", "end_time", "created_at")

    @extend_schema(request=EventStatusSerializer, responses={200: CalendarEventDetailSerializer})
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
        "create": (SchedulingPermissions.MANAGE,),
        "update": (SchedulingPermissions.UPDATE,),
        "partial_update": (SchedulingPermissions.UPDATE,),
        "destroy": (SchedulingPermissions.DELETE,),
        "book": (SchedulingPermissions.MANAGE,),
        "block": (SchedulingPermissions.MANAGE,),
    }

    filterset_class = ResourceFilterSet
    search_fields = ("name", "code", "location")
    ordering_fields = ("name", "capacity_hours_per_week", "hourly_rate_usd")
    # Ordering by pay rate is honoured only for holders of schedule.view_rates (SEC-SCH-01)
    filter_backends = (DjangoFilterBackend, RatesOrderingFilter, SearchFilter)

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
        "create": (SchedulingPermissions.MANAGE,),
        "update": (SchedulingPermissions.MANAGE,),
        "partial_update": (SchedulingPermissions.MANAGE,),
        "destroy": (SchedulingPermissions.DELETE,),
        "bulk_delete": (SchedulingPermissions.DELETE,),
    }

    # Notes of a booking can be hidden from the caller (D-21), so they are not searchable
    # (SEC-SCH-01): search matches the resource's name or code. The list takes ``start`` and
    # ``end`` (ISO 8601 with a time zone) to narrow to the bookings overlapping that window.
    filterset_class = BookingFilterSet
    search_fields = ("resource__name", "resource__code")
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

    @extend_schema(
        request=BookingBulkDeleteSerializer,
        responses={
            200: BookingBulkDeleteResponseSerializer,
            207: BookingBulkDeleteResponseSerializer,
        },
    )
    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request, *args, **kwargs):
        """
        Delete up to 100 bookings (decision Q36), for planners clearing a week. Each is its own
        transaction, so one failing does not stop the rest: 200 when all succeed, 207 otherwise.
        An unknown or already deleted booking reports ``not_found``.
        """
        body = BookingBulkDeleteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        visible = ResourceScheduleSelector.get_queryset(request=request)

        results = []
        for booking_id in body.validated_data["ids"]:
            booking = visible.filter(pk=booking_id).first()
            error = "not_found"
            if booking is not None:
                with transaction.atomic():
                    booking.soft_delete(user=request.user)
                error = None
            results.append({"id": str(booking_id), "ok": error is None, "error": error})

        failed = sum(1 for result in results if not result["ok"])
        return Response(
            {
                "success": failed == 0,
                "succeeded_count": len(results) - failed,
                "failed_count": failed,
                "results": results,
            },
            status=status.HTTP_200_OK if failed == 0 else status.HTTP_207_MULTI_STATUS,
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
        "update": (SchedulingPermissions.CREATE,),
        "partial_update": (SchedulingPermissions.CREATE,),
        "destroy": (SchedulingPermissions.DELETE,),
        "approve": (SchedulingPermissions.APPROVE,),
        "reject": (SchedulingPermissions.APPROVE,),
    }

    # The reason of a leave is hidden from most callers (D-20), so it is not searchable
    # (SEC-SCH-01): search matches the resource's name or code.
    filterset_class = LeaveFilterSet
    search_fields = ("resource__name", "resource__code")
    ordering_fields = ("start_date", "created_at")

    def perform_create(self, serializer):
        serializer.instance = create_leave(
            actor=self.request.user,
            manager=can_manage(self.request),
            requested=serializer.validated_data.get("resource"),
            data=serializer.validated_data,
        )

    def perform_update(self, serializer):
        leave = serializer.instance
        assert leave is not None  # an update always has the row it changes
        serializer.instance = update_leave(
            actor=self.request.user,
            manager=can_manage(self.request),
            leave=leave,
            data=serializer.validated_data,
        )

    @extend_schema(request=LeaveDecisionSerializer, responses={200: ResourceLeaveSerializer})
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        """Approve a pending leave request. Not your own, unless you hold the override (D-20)."""
        leave = self.get_object()
        body = LeaveDecisionSerializer(data=request.data)
        body.is_valid(raise_exception=True)

        leave = approve_leave(
            leave_id=leave.id,
            actor=request.user,
            can_override=can_decide_own_leave(request),
            override_reason=body.validated_data.get("override_reason", ""),
        )

        return Response(ResourceLeaveSerializer(leave, context=self.get_serializer_context()).data)

    @extend_schema(request=LeaveRejectSerializer, responses={200: ResourceLeaveSerializer})
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        """Reject a pending leave request with a reason. Not your own, unless you hold the override."""
        leave = self.get_object()
        body = LeaveRejectSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data

        leave = reject_leave(
            leave_id=leave.id,
            actor=request.user,
            rejection_reason=data.get("rejection_reason") or data.get("reason") or "",
            can_override=can_decide_own_leave(request),
            override_reason=data.get("override_reason", ""),
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
        "create": (SchedulingPermissions.MANAGE,),
        "update": (SchedulingPermissions.MANAGE,),
        "partial_update": (SchedulingPermissions.MANAGE,),
        "destroy": (SchedulingPermissions.MANAGE,),
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
        "create": (SchedulingPermissions.MANAGE,),
        "update": (SchedulingPermissions.MANAGE,),
        "partial_update": (SchedulingPermissions.MANAGE,),
        "destroy": (SchedulingPermissions.MANAGE,),
        "set_default": (SchedulingPermissions.MANAGE,),
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
        "create": (SchedulingPermissions.MANAGE,),
        "update": (SchedulingPermissions.MANAGE,),
        "partial_update": (SchedulingPermissions.MANAGE,),
        "destroy": (SchedulingPermissions.MANAGE,),
        "complete": (SchedulingPermissions.MANAGE,),
        "reopen": (SchedulingPermissions.MANAGE,),
    }

    filterset_class = MilestoneFilterSet
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
