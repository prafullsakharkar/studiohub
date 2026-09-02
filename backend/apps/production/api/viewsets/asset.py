from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.asset import AssetFilterSet
from apps.production.api.serializers.asset.create import AssetCreateSerializer
from apps.production.api.serializers.asset.detail import AssetDetailSerializer
from apps.production.api.serializers.asset.list import AssetListSerializer
from apps.production.api.serializers.asset.update import AssetUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import AssetPermissions
from apps.production.selectors.asset import AssetSelector
from apps.production.services.asset import AssetService


class AssetViewSet(ProductionEntityViewSet):
    selector_class = AssetSelector
    service_class = AssetService
    pagination_class = StandardPagination
    filterset_class = AssetFilterSet

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
