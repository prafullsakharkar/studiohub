from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.shot import ShotFilterSet
from apps.production.api.serializers.actions import (
    AssetLinkUpdateSerializer,
    LinkAssetSerializer,
    validated,
)
from apps.production.api.serializers.shot.create import ShotCreateSerializer
from apps.production.api.serializers.shot.detail import ShotDetailSerializer
from apps.production.api.serializers.shot.list import ShotListSerializer
from apps.production.api.serializers.shot.update import ShotUpdateSerializer
from apps.production.api.serializers.shot_asset import ShotAssetSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.api.viewsets.bulk import ProductionBulkMixin
from apps.production.api.viewsets.rename_code import RenameCodeMixin
from apps.production.api.viewsets.status_history import StatusHistoryMixin
from apps.production.constants.permissions import AssetPermissions, CodePermissions, ShotPermissions
from apps.production.constants.shot import ShotStatus
from apps.production.models import Asset
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.shot import ShotSelector
from apps.production.selectors.shot_asset import ShotAssetSelector
from apps.production.services.shot import ShotService
from apps.production.services.shot_asset import ShotAssetService
from apps.production.validators.episodic import apply_shot_episode_chain
from apps.production.validators.references import require_assignable_artist


class ShotViewSet(
    RenameCodeMixin, StatusHistoryMixin, ProductionEntityViewSet, ProductionBulkMixin
):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = ShotSelector
    service_class = ShotService
    pagination_class = StandardPagination
    filterset_class = ShotFilterSet
    detail_serializer_class = ShotDetailSerializer

    # CR-48: what bulk-update may change; never project, code, show, ownership or approval fields.
    requires_project_code_prefix = True
    bulk_update_fields = (
        "name",
        "description",
        "status",
        "sequence_id",
        "episode_id",
        "frame_in",
        "frame_out",
        "handle_frames",
        "assigned_artist",
    )

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
        "rename_code": (CodePermissions.RENAME,),
        "status_history": (ShotPermissions.VIEW,),
        "create": (ShotPermissions.CREATE,),
        "update": (ShotPermissions.UPDATE,),
        "partial_update": (ShotPermissions.UPDATE,),
        "destroy": (ShotPermissions.DELETE,),
        "approve": (ShotPermissions.APPROVE,),
        "bulk_create": (ShotPermissions.CREATE,),
        "bulk_update": (ShotPermissions.UPDATE,),
        "bulk_archive": (ShotPermissions.DELETE,),
        "bulk_restore": (ShotPermissions.UPDATE,),
        "check_existence": (ShotPermissions.CREATE,),
        "existence_check": (ShotPermissions.CREATE,),
        "archive": (ShotPermissions.DELETE,),
        "restore": (ShotPermissions.UPDATE,),
        "archived": (ShotPermissions.VIEW,),
        # Asset links: reading them needs to see assets too; changing them changes the shot.
        "assets": (ShotPermissions.VIEW, AssetPermissions.VIEW),
        "link_asset": (ShotPermissions.UPDATE, AssetPermissions.VIEW),
        "update_asset_link": (ShotPermissions.UPDATE,),
        "unlink_asset": (ShotPermissions.UPDATE,),
    }

    # Approving a shot's pipeline step, or client approval (which has no action
    # yet), needs the approve code, like the approve action. A change of the
    # shot's own status is checked by the status workflow (``StatusService``).
    privileged_values = {
        "pipeline": {ShotStatus.APPROVED.value: ShotPermissions.APPROVE},
        "client_approved": {True: ShotPermissions.APPROVE},
    }

    search_fields = ("code", "name", "description", "sequence__code")
    ordering_fields = ("code", "name", "created_at", "status")

    @action(detail=False, methods=["post"], url_path="bulk-archive")
    def bulk_archive(self, request, *args, **kwargs):
        """Bulk soft-delete with per-item ``not_found`` reporting."""
        return self._bulk_lifecycle_results(ids=self._ids_list(), action="archive")

    @action(detail=False, methods=["post"], url_path="bulk-restore")
    def bulk_restore(self, request, *args, **kwargs):
        """Bulk restore with per-item ``not_found`` reporting."""
        return self._bulk_lifecycle_results(ids=self._ids_list(), action="restore")

    def validate_references(self, project, data, instance=None):
        """The assigned artist must be an active member of the shot's project (CR-34)."""
        require_assignable_artist(project, data, instance)

    def prepare_create(self, serializer, project):
        data = serializer.validated_data if isinstance(serializer.validated_data, dict) else {}
        self._enforce_episode_sequence_chain(data, project=project, instance=None)

    def prepare_update(self, instance, data):
        self._enforce_episode_sequence_chain(data, project=instance.project, instance=instance)

    def _enforce_episode_sequence_chain(self, data, *, project, instance=None):
        """The episode/sequence chain of a shot (D-12; ``validators/episodic.py``)."""
        apply_shot_episode_chain(data, project=project, instance=instance)

    @extend_schema(responses=ShotAssetSerializer(many=True))
    @action(detail=True, methods=["get"], url_path="assets")
    def assets(self, request, *args, **kwargs):
        """The assets this shot uses (live links to live assets)."""
        shot = self.get_object()
        # Only the assets the caller may see: an external member is not shown the others.
        visible = ProductionBaseSelector.scope_by_project_membership(
            Asset.objects.all(), request=request
        )
        links = ShotAssetSelector.for_shot(shot).filter(asset_id__in=visible.values("id"))
        return Response(ShotAssetSerializer(links, many=True).data)

    @extend_schema(request=LinkAssetSerializer, responses=ShotAssetSerializer)
    @assets.mapping.post
    def link_asset(self, request, *args, **kwargs):
        """Link an asset of the shot's project (id or code) to the shot."""
        shot = self.get_object()
        body = validated(LinkAssetSerializer, request.data)
        link = ShotAssetService.link(
            user=request.user,
            shot=shot,
            asset_ref=body["asset_id"],
            quantity=body["quantity"],
            notes=body["notes"],
        )
        return Response(ShotAssetSerializer(link).data, status=201)

    @extend_schema(request=AssetLinkUpdateSerializer, responses=ShotAssetSerializer)
    @action(detail=True, methods=["patch"], url_path=r"assets/(?P<asset_ref>[^/.]+)")
    def update_asset_link(self, request, *args, asset_ref=None, **kwargs):
        """Change the quantity or note of one link."""
        shot = self.get_object()
        link = self._link_or_404(shot, asset_ref)
        body = validated(AssetLinkUpdateSerializer, request.data)
        link = ShotAssetService.update(
            user=request.user, link=link, quantity=body.get("quantity"), notes=body.get("notes")
        )
        return Response(ShotAssetSerializer(link).data)

    @extend_schema(request=None, responses={204: None})
    @update_asset_link.mapping.delete
    def unlink_asset(self, request, *args, asset_ref=None, **kwargs):
        """Remove one link (the asset and the shot are untouched)."""
        shot = self.get_object()
        ShotAssetService.unlink(user=request.user, link=self._link_or_404(shot, asset_ref))
        return Response(status=204)

    @staticmethod
    def _link_or_404(shot, asset_ref):
        link = ShotAssetService.find(shot, asset_ref)
        if link is None:
            raise NotFound("This asset is not linked to the shot.")
        return link

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        instance = self.get_object()
        ShotService.approve_shot(
            actor=request.user,
            shot=instance,
            has_permission=self.can,
            has_explicit=self.can_explicit,
        )
        return Response(ShotDetailSerializer(instance).data)
