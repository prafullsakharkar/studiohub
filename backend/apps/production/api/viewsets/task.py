from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.task import TaskFilterSet
from apps.production.api.serializers.task.create import TaskCreateSerializer
from apps.production.api.serializers.task.detail import TaskDetailSerializer
from apps.production.api.serializers.task.list import TaskListSerializer
from apps.production.api.serializers.task.update import TaskUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import TaskPermissions
from apps.production.selectors.task import TaskSelector
from apps.production.services.task import TaskService


class TaskViewSet(ProductionEntityViewSet):
    selector_class = TaskSelector
    service_class = TaskService
    pagination_class = StandardPagination
    filterset_class = TaskFilterSet

    serializer_map = {
        "list": TaskListSerializer,
        "retrieve": TaskDetailSerializer,
        "create": TaskCreateSerializer,
        "update": TaskUpdateSerializer,
        "partial_update": TaskUpdateSerializer,
    }

    permission_map = {
        "list": (TaskPermissions.VIEW,),
        "retrieve": (TaskPermissions.VIEW,),
        "create": (TaskPermissions.CREATE,),
        "update": (TaskPermissions.UPDATE,),
        "partial_update": (TaskPermissions.UPDATE,),
        "destroy": (TaskPermissions.DELETE,),
        "bulk_assign": (TaskPermissions.UPDATE,),
        "bulk_status": (TaskPermissions.UPDATE,),
        "bulk_archive": (TaskPermissions.UPDATE,),
        "bulk_delete": (TaskPermissions.DELETE,),
    }

    search_fields = ("title", "code", "description")
    ordering_fields = ("title", "code", "created_at", "status", "priority", "due_date")

    @action(detail=False, methods=["post"], url_path="bulk-assign")
    def bulk_assign(self, request, *args, **kwargs):
        task_ids = request.data.get("task_ids", [])
        assignee_id = request.data.get("assignee_id")
        team_id = request.data.get("team_id")
        updated = 0
        qs = self.get_queryset().filter(id__in=task_ids)
        for task in qs:
            if assignee_id:
                task.assignee_id = assignee_id
            if team_id:
                task.team_id = team_id
            task.save(update_fields=["assignee", "team"] if team_id else ["assignee"])
            updated += 1
        return Response({"success": True, "updated_count": updated})

    @action(detail=False, methods=["post"], url_path="bulk-status")
    def bulk_status(self, request, *args, **kwargs):
        task_ids = request.data.get("task_ids", [])
        status_val = request.data.get("status")
        if not status_val:
            return Response({"detail": "status is required."}, status=400)
        updated = self.get_queryset().filter(id__in=task_ids).update(status=status_val)
        return Response({"success": True, "updated_count": updated})

    @action(detail=False, methods=["post"], url_path="bulk-archive")
    def bulk_archive(self, request, *args, **kwargs):
        task_ids = request.data.get("task_ids", [])
        is_archived = request.data.get("is_archived", True)
        # Frontend sends boolean or undefined; handle string "true"/"false"
        if isinstance(is_archived, str):
            is_archived = is_archived.lower() in ("true", "1", "yes")
        updated = self.get_queryset().filter(id__in=task_ids).update(is_archived=is_archived)
        return Response({"success": True, "updated_count": updated})

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request, *args, **kwargs):
        task_ids = request.data.get("task_ids", [])
        qs = self.get_queryset().filter(id__in=task_ids)
        count = qs.count()
        qs.delete()
        return Response({"success": True, "deleted_count": count})
