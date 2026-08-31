"""
Scheduling viewsets for API endpoints.
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.scheduling.api.serializers import (
    CalendarEventListSerializer,
    CalendarEventDetailSerializer,
    CalendarEventCreateSerializer,
    CalendarEventUpdateSerializer,
    ResourceListSerializer,
    ResourceDetailSerializer,
    ResourceCreateSerializer,
    ResourceUpdateSerializer,
    ResourceScheduleSerializer,
    ResourceLeaveSerializer,
    HolidaySerializer,
)
from apps.scheduling.models import CalendarEvent, Resource, ResourceSchedule, ResourceLeave, Holiday
from apps.scheduling.selectors import (
    get_calendar_event_queryset,
    get_resource_queryset,
    get_resource_schedule_queryset,
    get_resource_leave_queryset,
    get_holiday_queryset,
)
from apps.scheduling.services import (
    create_calendar_event,
    update_calendar_event_status,
    book_resource,
    block_resource,
    submit_leave_request,
    approve_leave,
    reject_leave,
    create_holiday,
)


class CalendarEventViewSet(ServiceModelViewSet):
    """ViewSet for CalendarEvent."""
    
    queryset = CalendarEvent.objects.all()
    selector_class = None
    service_class = None
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission,)
    
    serializer_map = {
        "list": CalendarEventListSerializer,
        "retrieve": CalendarEventDetailSerializer,
        "create": CalendarEventCreateSerializer,
        "update": CalendarEventUpdateSerializer,
        "partial_update": CalendarEventUpdateSerializer,
    }
    
    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (),
        "update": (),
        "partial_update": (),
        "destroy": (),
        "update_status": (),
    }
    
    search_fields = ("title", "description", "location")
    ordering_fields = ("start_time", "end_time", "created_at")
    
    def get_queryset(self):
        return get_calendar_event_queryset(request=self.request, view=self)
    
    def perform_create(self, serializer):
        org = getattr(self.request, "organization", None)
        if org is None:
            org_id = self.request.headers.get("X-Organization-Id")
            if org_id:
                from apps.organization.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Exception:
                    pass
        if org is None and self.request.user.is_authenticated:
            from apps.organization.models import OrganizationMembership
            m = OrganizationMembership.objects.filter(user=self.request.user).first()
            if m:
                org = m.organization
        if org is None:
            from apps.organization.models import Organization
            org = Organization.objects.first()
        
        serializer.save(organization=org, created_by=self.request.user if self.request.user.is_authenticated else None)
    
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


class ResourceViewSet(ServiceModelViewSet):
    """ViewSet for Resource."""
    
    queryset = Resource.objects.all()
    selector_class = None
    service_class = None
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission,)
    
    serializer_map = {
        "list": ResourceListSerializer,
        "retrieve": ResourceDetailSerializer,
        "create": ResourceCreateSerializer,
        "update": ResourceUpdateSerializer,
        "partial_update": ResourceUpdateSerializer,
    }
    
    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (),
        "update": (),
        "partial_update": (),
        "destroy": (),
        "book": (),
        "block": (),
    }
    
    search_fields = ("name", "code", "location")
    ordering_fields = ("name", "capacity_hours_per_week", "hourly_rate_usd")
    
    def get_queryset(self):
        return get_resource_queryset(request=self.request, view=self)
    
    def perform_create(self, serializer):
        org = getattr(self.request, "organization", None)
        if org is None:
            org_id = self.request.headers.get("X-Organization-Id")
            if org_id:
                from apps.organization.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Exception:
                    pass
        if org is None and self.request.user.is_authenticated:
            from apps.organization.models import OrganizationMembership
            m = OrganizationMembership.objects.filter(user=self.request.user).first()
            if m:
                org = m.organization
        if org is None:
            from apps.organization.models import Organization
            org = Organization.objects.first()
        
        serializer.save(organization=org)
    
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
        )
        
        return Response(ResourceScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)


class ResourceScheduleViewSet(ServiceModelViewSet):
    """ViewSet for ResourceSchedule."""
    
    queryset = ResourceSchedule.objects.all()
    selector_class = None
    service_class = None
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission,)
    
    serializer_map = {
        "list": ResourceScheduleSerializer,
        "retrieve": ResourceScheduleSerializer,
        "create": ResourceScheduleSerializer,
        "update": ResourceScheduleSerializer,
        "partial_update": ResourceScheduleSerializer,
    }
    
    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (),
        "update": (),
        "partial_update": (),
        "destroy": (),
    }
    
    search_fields = ("notes",)
    ordering_fields = ("start_time", "end_time", "created_at")
    
    def get_queryset(self):
        return get_resource_schedule_queryset(request=self.request, view=self)


class ResourceLeaveViewSet(ServiceModelViewSet):
    """ViewSet for ResourceLeave."""
    
    queryset = ResourceLeave.objects.all()
    selector_class = None
    service_class = None
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission,)
    
    serializer_map = {
        "list": ResourceLeaveSerializer,
        "retrieve": ResourceLeaveSerializer,
        "create": ResourceLeaveSerializer,
        "update": ResourceLeaveSerializer,
        "partial_update": ResourceLeaveSerializer,
    }
    
    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (),
        "update": (),
        "partial_update": (),
        "destroy": (),
        "approve": (),
        "reject": (),
    }
    
    search_fields = ("reason",)
    ordering_fields = ("start_date", "created_at")
    
    def get_queryset(self):
        return get_resource_leave_queryset(request=self.request, view=self)
    
    def perform_create(self, serializer):
        org = getattr(self.request, "organization", None)
        if org is None:
            org_id = self.request.headers.get("X-Organization-Id")
            if org_id:
                from apps.organization.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Exception:
                    pass
        if org is None and self.request.user.is_authenticated:
            from apps.organization.models import OrganizationMembership
            m = OrganizationMembership.objects.filter(user=self.request.user).first()
            if m:
                org = m.organization
        if org is None:
            from apps.organization.models import Organization
            org = Organization.objects.first()
        
        # Get resource for user
        from apps.scheduling.models import Resource
        resource = Resource.objects.filter(
            user=self.request.user,
            organization=org,
        ).first()
        
        if resource:
            serializer.save(resource=resource)
    
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        """Approve leave request."""
        leave = self.get_object()
        
        leave = approve_leave(
            leave_id=str(leave.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
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
        )
        
        return Response(ResourceLeaveSerializer(leave).data)


class HolidayViewSet(ServiceModelViewSet):
    """ViewSet for Holiday."""
    
    queryset = Holiday.objects.all()
    selector_class = None
    service_class = None
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission,)
    
    serializer_map = {
        "list": HolidaySerializer,
        "retrieve": HolidaySerializer,
        "create": HolidaySerializer,
        "update": HolidaySerializer,
        "partial_update": HolidaySerializer,
    }
    
    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (),
        "update": (),
        "partial_update": (),
        "destroy": (),
    }
    
    search_fields = ("name", "description")
    ordering_fields = ("holiday_date", "created_at")
    
    def get_queryset(self):
        return get_holiday_queryset(request=self.request, view=self)
    
    def perform_create(self, serializer):
        org = getattr(self.request, "organization", None)
        if org is None:
            org_id = self.request.headers.get("X-Organization-Id")
            if org_id:
                from apps.organization.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Exception:
                    pass
        if org is None and self.request.user.is_authenticated:
            from apps.organization.models import OrganizationMembership
            m = OrganizationMembership.objects.filter(user=self.request.user).first()
            if m:
                org = m.organization
        if org is None:
            from apps.organization.models import Organization
            org = Organization.objects.first()
        
        serializer.save(organization=org)
