"""
Scheduling viewsets for API endpoints.
"""
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.api.viewsets.scoped import OrganizationScopedViewSet
from apps.scheduling.api.serializers import (
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

_RESOURCE_ORG_ERROR = "Resource must belong to the active organization."
_NO_USER_RESOURCE_ERROR = (
    "No scheduling resource is associated with the current user "
    "in this organization."
)


class CalendarEventViewSet(OrganizationScopedViewSet):
    """ViewSet for CalendarEvent."""

    selector_class = CalendarEventSelector
    pagination_class = StandardPagination
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
            organization_id=str(request.organization.id),
        )

        return Response(CalendarEventDetailSerializer(event).data)


class ResourceViewSet(OrganizationScopedViewSet):
    """ViewSet for Resource."""

    selector_class = ResourceSelector
    pagination_class = StandardPagination
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

        start_time = request.data.get("start_time")
        end_time = request.data.get("end_time")
        event_id = request.data.get("event_id")
        task_id = request.data.get("task_id")
        slot_status = request.data.get("status", "Booked")
        notes = request.data.get("notes", "")

        if not start_time or not end_time:
            return Response({"detail": "start_time and end_time are required."}, status=400)

        schedule = book_resource(
            resource_id=str(resource.id),
            start_time=start_time,
            end_time=end_time,
            event_id=event_id,
            task_id=task_id,
            status=slot_status,
            notes=notes,
            organization_id=str(request.organization.id),
        )

        return Response(ResourceScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="block")
    def block(self, request, *args, **kwargs):
        """Block the resource (mark as unavailable)."""
        resource = self.get_object()

        start_time = request.data.get("start_time")
        end_time = request.data.get("end_time")
        reason = request.data.get("reason", "")

        if not start_time or not end_time:
            return Response({"detail": "start_time and end_time are required."}, status=400)

        schedule = block_resource(
            resource_id=str(resource.id),
            start_time=start_time,
            end_time=end_time,
            reason=reason,
            organization_id=str(request.organization.id),
        )

        return Response(ResourceScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)


class ResourceScheduleViewSet(OrganizationScopedViewSet):
    """ViewSet for ResourceSchedule."""

    selector_class = ResourceScheduleSelector
    pagination_class = StandardPagination
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
        organization = self.require_organization()
        resource = serializer.validated_data.get("resource")
        if resource is None or resource.organization_id != organization.id:
            raise ValidationError({"resource": _RESOURCE_ORG_ERROR})
        serializer.save()

    def perform_update(self, serializer):
        organization = self.require_organization()
        resource = serializer.validated_data.get("resource")
        if resource is not None and resource.organization_id != organization.id:
            raise ValidationError({"resource": _RESOURCE_ORG_ERROR})
        serializer.save()


class ResourceLeaveViewSet(OrganizationScopedViewSet):
    """ViewSet for ResourceLeave."""

    selector_class = ResourceLeaveSelector
    pagination_class = StandardPagination
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
        organization = self.require_organization()
        resource = serializer.validated_data.get("resource")
        if resource is None:
            resource = Resource.objects.filter(
                user=self.request.user,
                organization=organization,
            ).first()
        if resource is None or resource.organization_id != organization.id:
            raise ValidationError({"resource": _NO_USER_RESOURCE_ERROR})
        serializer.save(resource=resource)

    def perform_update(self, serializer):
        organization = self.require_organization()
        resource = serializer.validated_data.get("resource")
        if resource is not None and resource.organization_id != organization.id:
            raise ValidationError({"resource": _RESOURCE_ORG_ERROR})
        serializer.save()

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        """Approve leave request."""
        leave = self.get_object()

        leave = approve_leave(
            leave_id=str(leave.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
            organization_id=str(request.organization.id),
        )

        return Response(ResourceLeaveSerializer(leave).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        """Reject leave request."""
        leave = self.get_object()

        rejection_reason = request.data.get("rejection_reason", "")
        if not rejection_reason:
            return Response({"detail": "rejection_reason is required."}, status=400)

        leave = reject_leave(
            leave_id=str(leave.id),
            rejection_reason=rejection_reason,
            organization_id=str(request.organization.id),
        )

        return Response(ResourceLeaveSerializer(leave).data)


class HolidayViewSet(OrganizationScopedViewSet):
    """ViewSet for Holiday."""

    selector_class = HolidaySelector
    pagination_class = StandardPagination
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
