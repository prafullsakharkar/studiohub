from rest_framework.decorators import action

from apps.core.api.mixins.bulk import BulkActionsMixin
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


class AssetViewSet(ProductionEntityViewSet, BulkActionsMixin):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = AssetSelector
    service_class = AssetService
    pagination_class = StandardPagination
    filterset_class = AssetFilterSet
    detail_serializer_class = AssetDetailSerializer

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
        "bulk_create": (AssetPermissions.CREATE,),
        "bulk_update": (AssetPermissions.UPDATE,),
        "bulk_archive": (AssetPermissions.DELETE,),
        "bulk_restore": (AssetPermissions.UPDATE,),
        "check_existence": (AssetPermissions.CREATE,),
        "existence_check": (AssetPermissions.CREATE,),
        "archive": (AssetPermissions.DELETE,),
        "restore": (AssetPermissions.UPDATE,),
        "archived": (AssetPermissions.VIEW,),
    }

    search_fields = ("name", "code", "category", "description")
    ordering_fields = ("name", "code", "created_at", "status")

    @action(detail=False, methods=["post"], url_path="bulk-archive")
    def bulk_archive(self, request, *args, **kwargs):
        """Bulk soft-delete with per-item ``not_found`` reporting."""
        return self._bulk_lifecycle_results(ids=self._ids_list(), action="archive")

    @action(detail=False, methods=["post"], url_path="bulk-restore")
    def bulk_restore(self, request, *args, **kwargs):
        """Bulk restore with per-item ``not_found`` reporting."""
        return self._bulk_lifecycle_results(ids=self._ids_list(), action="restore")
