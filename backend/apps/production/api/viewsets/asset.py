from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.constants.permissions import AssetPermissions
from apps.organization.middleware.organization_context import resolve_organization_context
from apps.production.api.filtersets.asset import AssetFilterSet
from apps.production.api.serializers.asset.create import AssetCreateSerializer
from apps.production.api.serializers.asset.detail import AssetDetailSerializer
from apps.production.api.serializers.asset.list import AssetListSerializer
from apps.production.api.serializers.asset.update import AssetUpdateSerializer
from apps.production.models import Asset
from apps.production.selectors.asset import AssetSelector
from apps.production.services.asset import AssetService


class AssetViewSet(ServiceModelViewSet):
    queryset = Asset.objects.all()
    selector_class = AssetSelector
    service_class = AssetService
    pagination_class = StandardPagination
    filterset_class = AssetFilterSet
    permission_classes = (IsAuthenticatedPermission, HasPermission,)

    serializer_map = {
        "list": AssetListSerializer,
        "retrieve": AssetDetailSerializer,
        "create": AssetCreateSerializer,
        "update": AssetUpdateSerializer,
        "partial_update": AssetUpdateSerializer,
    }

    permission_map = {
        "list": (AssetPermissions.VIEW,),
        "retrieve": (AssetPermissions.VIEW,),
        "create": (AssetPermissions.CREATE,),
        "update": (AssetPermissions.UPDATE,),
        "partial_update": (AssetPermissions.UPDATE,),
        "destroy": (AssetPermissions.DELETE,),
    }


    search_fields = ("name", "code", "category", "description")
    ordering_fields = ("name", "code", "created_at", "status")

    def perform_authentication(self, request):
        super().perform_authentication(request)
        resolve_organization_context(request, force=True)
        return request

    def perform_create(self, serializer):
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
