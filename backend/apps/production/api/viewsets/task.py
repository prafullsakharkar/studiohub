from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, NotFound
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.task import TaskFilterSet
from apps.production.api.serializers.actions import (
    BulkAssignSerializer,
    BulkStatusSerializer,
    TaskIdsSerializer,
    validated,
)
from apps.production.api.serializers.task.create import TaskCreateSerializer
from apps.production.api.serializers.task.detail import TaskDetailSerializer
from apps.production.api.serializers.task.list import TaskListSerializer
from apps.production.api.serializers.task.update import TaskUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.api.viewsets.bulk import ProductionBulkMixin
from apps.production.api.viewsets.status_history import StatusHistoryMixin
from apps.production.constants.permissions import TaskPermissions
from apps.production.selectors.task import TaskSelector
from apps.production.services.status import StatusService
from apps.production.services.task import TaskService
from apps.production.validators.references import require_project_member


# NOTE: ``bulk_assign``/``bulk_status``/``bulk_delete`` below are task-specific
# contract shapes ({success, updated_count}) and intentionally shadow nothing
# from the mixin. The task-specific ``bulk_archive`` was removed in favor of
# the mixin's union response (a superset containing success/updated_count).
class TaskViewSet(StatusHistoryMixin, ProductionEntityViewSet, ProductionBulkMixin):  # pyright: ignore[reportMissingTypeArgument]
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
        "status_history": (TaskPermissions.VIEW,),
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
        "archived": (TaskPermissions.VIEW,),
    }

    search_fields = ("title", "code", "description")
    ordering_fields = ("title", "code", "created_at", "status", "priority", "due_date")

    def validate_references(self, project, data, instance=None):
        """Assignee and reviewer must be active members of the task's project."""
        if project is None:
            return
        for field in ("assignee", "reviewer"):
            require_project_member(project, data.get(field), field=field, label="user")

    @extend_schema(request=BulkAssignSerializer)
    @action(detail=False, methods=["post"], url_path="bulk-assign")
    def bulk_assign(self, request, *args, **kwargs):
        from django.contrib.auth import get_user_model
        from rest_framework.exceptions import ValidationError

        from apps.masterdata.models import Team
        from apps.production.models import Project

        body = validated(BulkAssignSerializer, request.data)
        task_ids = body["task_ids"]
        assignee_id = body.get("assignee_id")
        team_id = body.get("team_id")
        tasks = list(self.get_queryset().filter(id__in=task_ids))
        assignee = None
        if assignee_id:
            assignee = get_user_model().objects.filter(id=assignee_id).first()
            if assignee is None:
                raise ValidationError({"assignee_id": "Unknown assignee."})
            # Membership is checked against each task's own project, so the
            # assignee cannot be pushed into a project they do not belong to.
            for project in Project.objects.filter(id__in={task.project_id for task in tasks}):
                require_project_member(project, assignee, field="assignee_id", label="assignee")
        team = None
        if team_id:
            team = Team.objects.filter(id=team_id, is_deleted=False).first()
            if team is None:
                raise ValidationError({"team_id": "Unknown team."})
        results = []
        for task in tasks:
            TaskService.assign_task(actor=request.user, task=task, assignee=assignee, team=team)
            results.append({"id": str(task.id), "status": "updated"})
        return Response({"success": True, "updated_count": len(tasks), "results": results})

    @extend_schema(request=BulkStatusSerializer)
    @action(detail=False, methods=["post"], url_path="bulk-status")
    def bulk_status(self, request, *args, **kwargs):
        from rest_framework.exceptions import ValidationError

        from apps.production.constants.task import TaskStatus

        body = validated(BulkStatusSerializer, request.data)
        status_val = body["status"]
        valid_statuses = [choice[0] for choice in TaskStatus.choices]
        if status_val not in valid_statuses:
            raise ValidationError(
                {"status": f"Invalid status. Valid values: {valid_statuses}."}
            )
        found = {str(task.id): task for task in self.get_queryset().filter(id__in=body["task_ids"])}
        results = []
        for task_id in dict.fromkeys(str(task_id) for task_id in body["task_ids"]):
            task = found.get(task_id)
            if task is None:
                results.append({"id": task_id, "status": "not_found"})
                continue
            try:
                StatusService.transition_status(
                    actor=request.user, entity=task, to_status=status_val, has_permission=self.can
                )
            except APIException as exc:
                results.append({"id": task_id, "status": "invalid", "error": exc.detail})
                continue
            results.append({"id": task_id, "status": "updated"})
        updated = sum(1 for row in results if row["status"] == "updated")
        failed = len(results) - updated
        return Response(
            {"success": failed == 0, "updated_count": updated, "failed_count": failed, "results": results}
        )

    @action(detail=False, methods=["post"], url_path="bulk-archive")
    def bulk_archive(self, request, *args, **kwargs):
        # Task archive flips the is_archived flag + status AND soft-deletes,
        # mirroring the mock (is_archived + is_deleted + status 'Archived').
        results = []
        for index, item_id in enumerate(self._ids_list()):
            instance = self.get_queryset().filter(id=item_id).first()
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
        instance = self.get_queryset().filter(id=self._lookup_id(kwargs)).first()
        if instance is None:
            raise NotFound("Task not found.")
        instance.is_archived = True
        instance.save(update_fields=["is_archived"])
        self._set_status(instance, "Archived")
        self.service_class.delete(instance, user=request.user)
        return Response(self._detail_data(instance))

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        from apps.production.selectors.base import ProductionBaseSelector

        instance = ProductionBaseSelector.scope_by_project_membership(
            self.service_class.model.all_objects.filter(id=self._lookup_id(kwargs)),
            request=request,
        ).first()
        if instance is None or not instance.is_deleted:
            raise NotFound("Task not found.")
        self.service_class.restore(instance)
        instance.is_archived = False
        instance.save(update_fields=["is_archived"])
        self._set_status(instance, "In Progress")
        return Response(self._detail_data(instance))

    @extend_schema(request=TaskIdsSerializer)
    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request, *args, **kwargs):
        # Soft-delete per instance through the service layer (queryset
        # .delete() would hard-delete rows and skip services/events).
        task_ids = validated(TaskIdsSerializer, request.data)["task_ids"]
        deleted = 0
        for task in self.get_queryset().filter(id__in=task_ids):
            self.service_class.delete(task, user=request.user)
            deleted += 1
        return Response({"success": True, "deleted_count": deleted})
