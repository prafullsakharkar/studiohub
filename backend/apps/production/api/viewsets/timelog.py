from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.timelog import TimelogFilterSet
from apps.production.api.serializers.actions import RejectTimelogSerializer, validated
from apps.production.api.serializers.timelog.create import TimelogCreateSerializer
from apps.production.api.serializers.timelog.detail import TimelogDetailSerializer
from apps.production.api.serializers.timelog.list import TimelogListSerializer
from apps.production.api.serializers.timelog.update import TimelogUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.api.viewsets.status_history import StatusHistoryMixin
from apps.production.constants.permissions import TimelogPermissions
from apps.production.permissions.checks import has_permission_code
from apps.production.selectors.timelog import TimelogSelector
from apps.production.services.timelog import TimelogService
from apps.production.validators.references import require_project_member, unknown


class TimelogViewSet(StatusHistoryMixin, ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
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
        "status_history": (TimelogPermissions.VIEW,),
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

    def validate_references(self, project, data, instance=None):
        """
        The task must belong to the timelog's project, and the time is logged
        for the caller unless they hold ``timelog.manage`` and name a member.
        """
        if instance is not None or project is None:
            return
        task = data.get("task")
        if task is not None and task.project_id != project.id:
            raise unknown("task", "task")
        person = data.get("person")
        if person is not None and person.pk != self.request.user.pk:
            if not has_permission_code(self.request, TimelogPermissions.MANAGE):
                raise PermissionDenied(
                    f"Logging time for someone else requires {TimelogPermissions.MANAGE}."
                )
            require_project_member(project, person, field="person_id", label="person")

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        instance = self.get_object()
        TimelogService.approve(actor=request.user, timelog=instance, has_permission=self.can)
        return Response(TimelogDetailSerializer(instance).data)

    @extend_schema(request=RejectTimelogSerializer)
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(RejectTimelogSerializer, request.data)
        TimelogService.reject(
            actor=request.user,
            timelog=instance,
            reason=body.get("rejection_reason", ""),
            has_permission=self.can,
        )
        return Response(TimelogDetailSerializer(instance).data)
