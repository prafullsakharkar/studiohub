"""``/task-templates/``: the tasks an entity starts with (WP D3, DECISIONS D-27)."""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform_crud import PlatformCrudViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.core.services.soft_delete import SoftDeleteService
from apps.identity.permissions import HasPermission
from apps.production.api.filtersets.task_template import TaskTemplateFilterSet
from apps.production.api.serializers.actions import validated
from apps.production.api.serializers.task_template import (
    ApplyTemplateSerializer,
    CopyTemplateSerializer,
    TaskTemplateCreateSerializer,
    TaskTemplateSerializer,
    TaskTemplateUpdateSerializer,
)
from apps.production.constants.permissions import TaskPermissions, TaskTemplatePermissions
from apps.production.permissions.checks import has_permission_code
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.project import ProjectSelector
from apps.production.selectors.task_template import TaskTemplateSelector
from apps.production.services.task_template import TaskTemplateService


class TaskTemplateViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = TaskTemplateSelector
    pagination_class = StandardPagination
    filterset_class = TaskTemplateFilterSet
    permission_classes = (IsAuthenticatedPermission, HasPermission)
    serializer_map = {
        "list": TaskTemplateSerializer,
        "retrieve": TaskTemplateSerializer,
        "create": TaskTemplateCreateSerializer,
        "update": TaskTemplateUpdateSerializer,
        "partial_update": TaskTemplateUpdateSerializer,
    }
    permission_map = {
        "list": (TaskTemplatePermissions.VIEW,),
        "retrieve": (TaskTemplatePermissions.VIEW,),
        "create": (TaskTemplatePermissions.CREATE,),
        "update": (TaskTemplatePermissions.UPDATE,),
        "partial_update": (TaskTemplatePermissions.UPDATE,),
        "destroy": (TaskTemplatePermissions.DELETE,),
        "apply": (TaskTemplatePermissions.VIEW, TaskPermissions.CREATE),
        "copy_to_project": (TaskTemplatePermissions.CREATE,),
    }
    search_fields = ("name", "description")
    ordering_fields = ("name", "created_at")

    # -- helpers --------------------------------------------------------------

    def _out(self, template):
        return TaskTemplateSerializer(template, context=self.get_serializer_context()).data

    def _require_studio_right(self, project):
        """Studio-wide templates (no project) take ``tasktemplate.manage_studio`` on top."""
        if project is None and not has_permission_code(
            self.request, TaskTemplatePermissions.MANAGE_STUDIO
        ):
            raise PermissionDenied(
                f"Studio-wide templates need {TaskTemplatePermissions.MANAGE_STUDIO}."
            )

    def _project_of_caller(self, ref, *, field="project_id"):
        """A project the caller belongs to (any for platform admins); else 'Unknown project.'."""
        project = ProjectSelector.resolve_by_lookup(ref) if str(ref or "").strip() else None
        if project is None or not ProductionBaseSelector.user_has_project_access(
            request=self.request, project=project
        ):
            raise ValidationError({field: ["Unknown project."]})
        return project

    # -- CRUD -----------------------------------------------------------------

    @extend_schema(request=TaskTemplateCreateSerializer, responses=TaskTemplateSerializer)
    def create(self, request, *args, **kwargs):
        body = validated(TaskTemplateCreateSerializer, request.data)
        raw_project = body.pop("project_id", None)
        project = self._project_of_caller(raw_project) if str(raw_project or "").strip() else None
        self._require_studio_right(project)
        items = body.pop("items")
        template = TaskTemplateService.create(
            user=request.user, project=project, data=body, items=items
        )
        return Response(self._out(template), status=201)

    @extend_schema(request=TaskTemplateUpdateSerializer, responses=TaskTemplateSerializer)
    def update(self, request, *args, **kwargs):
        template = self.get_object()
        self._require_studio_right(template.project)
        body = validated(TaskTemplateUpdateSerializer, request.data)
        items = body.pop("items", None)
        template = TaskTemplateService.update(
            user=request.user, template=template, data=body, items=items
        )
        return Response(self._out(template))

    def destroy(self, request, *args, **kwargs):
        template = self.get_object()
        self._require_studio_right(template.project)
        SoftDeleteService.delete(template, user=request.user)
        return Response(status=204)

    # -- actions --------------------------------------------------------------

    @extend_schema(request=ApplyTemplateSerializer)
    @action(detail=True, methods=["post"], url_path="apply")
    def apply(self, request, *args, **kwargs):
        """Create this template's tasks for a shot or asset; ones it already has are kept."""
        template = self.get_object()
        body = validated(ApplyTemplateSerializer, request.data)
        raw_project = body.get("project_id") or (
            str(template.project_id) if template.project_id else ""
        )
        project = self._project_of_caller(raw_project)
        if template.project_id is not None and project.pk != template.project_id:
            raise ValidationError({"project_id": ["Unknown project."]})
        entity = TaskTemplateService.resolve_entity(template, project, body["entity_id"])
        result = TaskTemplateService.apply(user=request.user, template=template, entity=entity)

        def brief(task):
            return {
                "id": str(task.id),
                "code": task.code,
                "title": task.title,
                "task_type_id": str(task.task_type_id),
                "estimated_hours": str(task.estimated_hours),
            }

        data = {key: [brief(task) for task in tasks] for key, tasks in result.items()}
        return Response(data, status=201 if result["created"] else 200)

    @extend_schema(request=CopyTemplateSerializer, responses=TaskTemplateSerializer)
    @action(detail=True, methods=["post"], url_path="copy-to-project")
    def copy_to_project(self, request, *args, **kwargs):
        """A copy of this template (studio-wide or another project's) that belongs to a project."""
        template = self.get_object()
        body = validated(CopyTemplateSerializer, request.data)
        project = self._project_of_caller(body["project_id"])
        copy = TaskTemplateService.copy_to_project(
            user=request.user, template=template, project=project, name=body.get("name")
        )
        return Response(self._out(copy), status=201)
