from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.constants.permissions import TimelogPermissions
from apps.organization.middleware.organization_context import resolve_organization_context
from apps.production.api.filtersets.timelog import TimelogFilterSet
from apps.production.api.serializers.timelog.create import TimelogCreateSerializer
from apps.production.api.serializers.timelog.detail import TimelogDetailSerializer
from apps.production.api.serializers.timelog.list import TimelogListSerializer
from apps.production.api.serializers.timelog.update import TimelogUpdateSerializer
from apps.production.models import Timelog
from apps.production.selectors.timelog import TimelogSelector
from apps.production.services.timelog import TimelogService


class TimelogViewSet(ServiceModelViewSet):
    queryset = Timelog.objects.all()
    selector_class = TimelogSelector
    service_class = TimelogService
    pagination_class = StandardPagination
    filterset_class = TimelogFilterSet
    permission_classes = (IsAuthenticatedPermission, HasPermission,)

    serializer_map = {
        "list": TimelogListSerializer,
        "retrieve": TimelogDetailSerializer,
        "create": TimelogCreateSerializer,
        "update": TimelogUpdateSerializer,
        "partial_update": TimelogUpdateSerializer,
    }

    permission_map = {
        "list": (TimelogPermissions.VIEW,),
        "retrieve": (TimelogPermissions.VIEW,),
        "create": (TimelogPermissions.CREATE,),
        "update": (TimelogPermissions.UPDATE,),
        "partial_update": (TimelogPermissions.UPDATE,),
        "destroy": (TimelogPermissions.DELETE,),
        "approve": (TimelogPermissions.APPROVE,),
        "reject": (TimelogPermissions.APPROVE,),
    }


    search_fields = ("notes",)
    ordering_fields = ("date", "created_at", "duration_hours")

    def perform_authentication(self, request):
        super().perform_authentication(request)
        resolve_organization_context(request, force=True)
        return request

    def perform_create(self, serializer):
        # Auto-assign organization/project/task_code etc from task
        task = serializer.validated_data.get("task")
        org = getattr(self.request, "organization", None)
        project = serializer.validated_data.get("project") or getattr(task, "project", None) if task else None
        if org is None:
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
        # Person is the current user if not provided
        person = serializer.validated_data.get("person") or self.request.user
        # Fill denormalized fields from task if available
        extra = {}
        if task:
            extra["task_code"] = getattr(task, "code", "")
            extra["task_title"] = getattr(task, "title", "")
            extra["project"] = getattr(task, "project", project)
            extra["project_code"] = getattr(task.project, "code", "") if getattr(task, "project", None) else ""
        serializer.save(organization=org, person=person, **extra)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.status = "Approved"
        instance.approved_by = request.user if request.user.is_authenticated else None
        instance.approved_at = timezone.now()
        instance.save(update_fields=["status", "approved_by", "approved_at"])
        serializer = TimelogDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.status = "Rejected"
        instance.rejection_reason = request.data.get("rejection_reason", "")
        instance.save(update_fields=["status", "rejection_reason"])
        serializer = TimelogDetailSerializer(instance)
        return Response(serializer.data)
