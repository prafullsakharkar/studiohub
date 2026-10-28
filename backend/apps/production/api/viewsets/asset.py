from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.asset import AssetFilterSet
from apps.production.api.serializers.asset.create import AssetCreateSerializer
from apps.production.api.serializers.asset.detail import AssetDetailSerializer
from apps.production.api.serializers.asset.list import AssetListSerializer
from apps.production.api.serializers.asset.update import AssetUpdateSerializer
from apps.production.api.serializers.shot_asset import AssetShotSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.api.viewsets.bulk import ProductionBulkMixin
from apps.production.api.viewsets.rename_code import RenameCodeMixin
from apps.production.constants.permissions import AssetPermissions, CodePermissions, ShotPermissions
from apps.production.models import Asset, Shot
from apps.production.selectors.asset import AssetSelector
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.shot_asset import ShotAssetSelector
from apps.production.services.asset import AssetService
from apps.production.validators.references import resolve_in_project


class AssetViewSet(RenameCodeMixin, ProductionEntityViewSet, ProductionBulkMixin):  # pyright: ignore[reportMissingTypeArgument]
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
        "rename_code": (CodePermissions.RENAME,),
        "shots": (AssetPermissions.VIEW, ShotPermissions.VIEW),
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

    @extend_schema(responses=AssetShotSerializer(many=True))
    @action(detail=True, methods=["get"], url_path="shots")
    def shots(self, request, *args, **kwargs):
        """The shots that use this asset (live links to live shots)."""
        asset = self.get_object()
        # Only the shots the caller may see: an external member is not shown the others.
        visible = ProductionBaseSelector.scope_by_project_membership(
            Shot.objects.all(), request=request
        )
        links = ShotAssetSelector.for_asset(asset).filter(shot_id__in=visible.values("id"))
        return Response(AssetShotSerializer(links, many=True).data)

    #: how far up the parent chain a cycle check looks; older data may already hold a loop
    MAX_PARENT_DEPTH = 50

    def validate_references(self, project, data, instance=None):
        """Asset type from the catalog; the parent asset in the same project and no loop."""
        self._resolve_asset_type(data)
        parent = data.get("parent_asset")
        if parent is None or project is None:
            return
        parent = resolve_in_project(
            Asset, project, parent, field="parent_asset", label="parent asset"
        )
        if instance is not None:
            node, steps = parent, 0
            while node is not None and steps < self.MAX_PARENT_DEPTH:
                if node.pk == instance.pk:
                    raise ValidationError(
                        {"parent_asset": ["An asset cannot be its own ancestor."]}
                    )
                node = (
                    Asset.all_objects.filter(pk=node.parent_asset_id).first()
                    if node.parent_asset_id
                    else None
                )
                steps += 1

    @staticmethod
    def _resolve_asset_type(data):
        """``asset_type_id`` arrives as an id or code: make it the catalog entry, or 'Unknown asset type.'."""
        from uuid import UUID

        from apps.masterdata.models import MasterAssetType

        if "asset_type" not in data:
            return
        raw = data["asset_type"]
        text = str(raw or "").strip()
        if not text:
            data["asset_type"] = None
            return
        base = MasterAssetType.objects.filter(status="active")
        try:
            entry = base.filter(pk=UUID(text)).first()
        except ValueError:
            entry = base.filter(code__iexact=text).first()
        if entry is None:
            raise ValidationError({"asset_type_id": ["Unknown asset type."]})
        data["asset_type"] = entry
