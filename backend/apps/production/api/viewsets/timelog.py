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


class TimelogViewSet(ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
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
        "archived": (TimelogPermissions.VIEW,),
        "restore": (TimelogPermissions.UPDATE,),
    }

    search_fields = ("notes",)
    ordering_fields = ("date", "created_at", "duration_hours")

    def perform_create(self, serializer):
        data = serializer.validated_data
        task = data.get("task")
        if data.get("person") is None and self.request.user.is_authenticated:
            data["person"] = self.request.user
        if task is not None:
            data["task_code"] = getattr(task, "code", "") or ""
            data["task_title"] = getattr(task, "title", "") or ""
            if getattr(task, "project", None) is not None:
                data["project"] = task.project
                data["project_code"] = getattr(task.project, "code", "") or ""
        super().perform_create(serializer)

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
