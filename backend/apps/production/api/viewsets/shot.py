from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.constants.permissions import ShotPermissions
from apps.organization.middleware.organization_context import resolve_organization_context
from apps.production.api.filtersets.shot import ShotFilterSet
from apps.production.api.serializers.shot.create import ShotCreateSerializer
from apps.production.api.serializers.shot.detail import ShotDetailSerializer
from apps.production.api.serializers.shot.list import ShotListSerializer
from apps.production.api.serializers.shot.update import ShotUpdateSerializer
from apps.production.models import Shot
from apps.production.selectors.shot import ShotSelector
from apps.production.services.shot import ShotService


class ShotViewSet(ServiceModelViewSet):
    queryset = Shot.objects.all()
    selector_class = ShotSelector
    service_class = ShotService
    pagination_class = StandardPagination
    filterset_class = ShotFilterSet
    permission_classes = (IsAuthenticatedPermission, HasPermission,)

    serializer_map = {
        "list": ShotListSerializer,
        "retrieve": ShotDetailSerializer,
        "create": ShotCreateSerializer,
        "update": ShotUpdateSerializer,
        "partial_update": ShotUpdateSerializer,
    }

    permission_map = {
        "list": (ShotPermissions.VIEW,),
        "retrieve": (ShotPermissions.VIEW,),
        "create": (ShotPermissions.CREATE,),
        "update": (ShotPermissions.UPDATE,),
        "partial_update": (ShotPermissions.UPDATE,),
        "destroy": (ShotPermissions.DELETE,),
        "approve": (ShotPermissions.APPROVE,),
    }


    search_fields = ("code", "name", "description", "sequence_code")
    ordering_fields = ("code", "name", "created_at", "status")

    def perform_authentication(self, request):
        super().perform_authentication(request)
        resolve_organization_context(request, force=True)
        return request

    def perform_create(self, serializer):
        # Auto-assign organization from project or header
        project = serializer.validated_data.get("project")
        org = getattr(project, "organization", None) if project else None
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
        serializer.save(organization=org)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.status = "Approved"
        instance.supervisor_approved = True
        # Set all pipeline stages to Approved
        if instance.pipeline:
            for k in instance.pipeline:
                instance.pipeline[k] = "Approved"
        instance.save(update_fields=["status", "supervisor_approved", "pipeline"])
        serializer = ShotDetailSerializer(instance)
        return Response(serializer.data)
