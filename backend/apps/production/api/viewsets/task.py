from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.task import TaskFilterSet
from apps.production.api.serializers.task.create import TaskCreateSerializer
from apps.production.api.serializers.task.detail import TaskDetailSerializer
from apps.production.api.serializers.task.list import TaskListSerializer
from apps.production.api.serializers.task.update import TaskUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.api.viewsets.bulk import BulkContractViewSetMixin
from apps.production.constants.permissions import TaskPermissions
from apps.production.selectors.task import TaskSelector
from apps.production.services.task import TaskService


# NOTE: ``bulk_assign``/``bulk_status``/``bulk_delete`` below are task-specific
# contract shapes ({success, updated_count}) and intentionally shadow nothing
# from the mixin. The task-specific ``bulk_archive`` was removed in favor of
# the mixin's union response (a superset containing success/updated_count).
class TaskViewSet(BulkContractViewSetMixin, ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = TaskSelector
    service_class = TaskService
    pagination_class = StandardPagination
    filterset_class = TaskFilterSet
    detail_serializer_class = TaskDetailSerializer

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
        "bulk_restore": (TaskPermissions.UPDATE,),
        "bulk_create": (TaskPermissions.CREATE,),
        "bulk_update": (TaskPermissions.UPDATE,),
        "bulk_delete": (TaskPermissions.DELETE,),
        "check_existence": (TaskPermissions.CREATE,),
        "existence_check": (TaskPermissions.CREATE,),
        "archive": (TaskPermissions.UPDATE,),
        "restore": (TaskPermissions.UPDATE,),
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
        # Task archive flips the is_archived flag + status AND soft-deletes,
        # mirroring the mock (is_archived + is_deleted + status 'Archived').
        org = self._organization()
        results = []
        for index, item_id in enumerate(self._ids_list()):
            instance = self.service_class.model.objects.filter(
                organization=org,
                id=item_id,
            ).first()
            if instance is None:
                results.append(
                    {"index": index, "id": item_id, "status": self.service_class.NOT_FOUND}
                )
                continue
            instance.is_archived = True
            instance.save(update_fields=["is_archived"])
            self._set_status(instance, "Archived")
            self.service_class.delete(instance, user=request.user)
            results.append(
                {"index": index, "id": item_id, "status": self.service_class.ARCHIVED}
            )
        return self._bulk_archive_union(results, count_key="archivedCount")

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        instance = self.service_class.model.objects.filter(
            organization=self._organization(),
            id=self._lookup_id(kwargs),
        ).first()
        if instance is None:
            raise NotFound("Task not found.")
        instance.is_archived = True
        instance.save(update_fields=["is_archived"])
        self._set_status(instance, "Archived")
        self.service_class.delete(instance, user=request.user)
        return Response(self._detail_data(instance))

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        instance = self.service_class.model.all_objects.filter(
            organization=self._organization(),
            id=self._lookup_id(kwargs),
        ).first()
        if instance is None or not instance.is_deleted:
            raise NotFound("Task not found.")
        self.service_class.restore(instance)
        instance.is_archived = False
        instance.save(update_fields=["is_archived"])
        self._set_status(instance, "In Progress")
        return Response(self._detail_data(instance))

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request, *args, **kwargs):
        task_ids = request.data.get("task_ids", [])
        qs = self.get_queryset().filter(id__in=task_ids)
        count = qs.count()
        qs.delete()
        return Response({"success": True, "deleted_count": count})
