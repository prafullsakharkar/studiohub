import datetime
import uuid

from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.workflow import WorkflowFilterSet
from apps.production.api.serializers.workflow.create import WorkflowCreateSerializer
from apps.production.api.serializers.workflow.detail import WorkflowDetailSerializer
from apps.production.api.serializers.workflow.list import WorkflowListSerializer
from apps.production.api.serializers.workflow.update import WorkflowUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import WorkflowPermissions
from apps.production.models import Workflow
from apps.production.selectors.workflow import WorkflowSelector
from apps.production.services.workflow import WorkflowService


class WorkflowViewSet(ProductionEntityViewSet):
    selector_class = WorkflowSelector
    service_class = WorkflowService
    pagination_class = StandardPagination
    filterset_class = WorkflowFilterSet
    serializer_map = {
        "list": WorkflowListSerializer,
        "retrieve": WorkflowDetailSerializer,
        "create": WorkflowCreateSerializer,
        "update": WorkflowUpdateSerializer,
        "partial_update": WorkflowUpdateSerializer,
    }

    permission_map = {
        "list": (WorkflowPermissions.VIEW,),
        "retrieve": (WorkflowPermissions.VIEW,),
        "create": (WorkflowPermissions.CREATE,),
        "update": (WorkflowPermissions.UPDATE,),
        "partial_update": (WorkflowPermissions.UPDATE,),
        "destroy": (WorkflowPermissions.DELETE,),
        "simulate": (WorkflowPermissions.VIEW,),
        "clone": (WorkflowPermissions.CREATE,),
        "activate": (WorkflowPermissions.UPDATE,),
        "deactivate": (WorkflowPermissions.UPDATE,),
        "archive": (WorkflowPermissions.DELETE,),
    }

    search_fields = ("name", "code", "description")
    ordering_fields = ("name", "created_at")

    @action(detail=True, methods=["post"], url_path="simulate")
    def simulate(self, request, *args, **kwargs):
        instance = self.get_object()
        # Dry-run simulation
        result = {
            "simulation_id": str(uuid.uuid4()),
            "overall_status": "success",
            "steps": [{"node": n.get("id"), "status": "success"} for n in (instance.nodes or [])],
            "side_effects": [],
            "audit_entry": {"workflow_id": str(instance.id), "timestamp": datetime.datetime.now().isoformat()},
        }
        return Response(result)

    @action(detail=True, methods=["post"], url_path="clone")
    def clone(self, request, *args, **kwargs):
        instance = self.get_object()
        new = Workflow.objects.create(
            organization=instance.organization,
            project=instance.project,
            name=instance.name + " (Copy)",
            code=instance.code + "-COPY",
            description=instance.description,
            category=instance.category,
            is_active=False,
            department=instance.department,
            nodes=instance.nodes,
            transitions=instance.transitions,
            automation_rules=instance.automation_rules,
        )
        return Response(WorkflowDetailSerializer(new).data, status=201)

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = True
        instance.save(update_fields=["is_active"])
        return Response(WorkflowDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(WorkflowDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_archived = True
        instance.is_active = False
        instance.save(update_fields=["is_archived", "is_active"])
        return Response(WorkflowDetailSerializer(instance).data)
