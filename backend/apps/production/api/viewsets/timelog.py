from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.timelog import TimelogFilterSet
from apps.production.api.serializers.timelog.create import TimelogCreateSerializer
from apps.production.api.serializers.timelog.detail import TimelogDetailSerializer
from apps.production.api.serializers.timelog.list import TimelogListSerializer
from apps.production.api.serializers.timelog.update import TimelogUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import TimelogPermissions
from apps.production.selectors.timelog import TimelogSelector
from apps.production.services.timelog import TimelogService


class TimelogViewSet(ProductionEntityViewSet):
    selector_class = TimelogSelector
    service_class = TimelogService
    pagination_class = StandardPagination
    filterset_class = TimelogFilterSet

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

    def perform_create(self, serializer):
        task = serializer.validated_data.get("task")
        project = serializer.validated_data.get("project") or getattr(task, "project", None)
        org = self.resolve_organization(instance=project)
        person = serializer.validated_data.get("person") or self.request.user
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
