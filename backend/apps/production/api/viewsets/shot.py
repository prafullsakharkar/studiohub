from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
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
from apps.production.constants import ProjectWorkflowType
from apps.production.constants.permissions import AssetPermissions, CodePermissions, ShotPermissions
from apps.production.constants.shot import ShotStatus
from apps.production.models import Episode
from apps.production.selectors.episode import EpisodeSelector
from apps.production.selectors.sequence import SequenceSelector
from apps.production.selectors.shot import ShotSelector
from apps.production.selectors.shot_asset import ShotAssetSelector
from apps.production.services.shot import ShotService
from apps.production.services.shot_asset import ShotAssetService


class ShotViewSet(
    RenameCodeMixin, StatusHistoryMixin, ProductionEntityViewSet, ProductionBulkMixin
):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = ShotSelector
    service_class = ShotService
    pagination_class = StandardPagination
    filterset_class = ShotFilterSet
    detail_serializer_class = ShotDetailSerializer

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

    search_fields = ("code", "name", "description", "sequence_code")
    ordering_fields = ("code", "name", "created_at", "status")

    @action(detail=False, methods=["post"], url_path="bulk-archive")
    def bulk_archive(self, request, *args, **kwargs):
        """Bulk soft-delete with per-item ``not_found`` reporting."""
        return self._bulk_lifecycle_results(ids=self._ids_list(), action="archive")

    @action(detail=False, methods=["post"], url_path="bulk-restore")
    def bulk_restore(self, request, *args, **kwargs):
        """Bulk restore with per-item ``not_found`` reporting."""
        return self._bulk_lifecycle_results(ids=self._ids_list(), action="restore")

    def prepare_create(self, serializer, project):
        self._enforce_episode_sequence_chain(serializer, project=project, instance=None)

    def perform_update(self, serializer):
        instance = self.get_object()
        self._enforce_episode_sequence_chain(
            serializer, project=instance.project, instance=instance
        )
        super().perform_update(serializer)

    def _enforce_episode_sequence_chain(self, serializer, *, project, instance=None):
        """
        Resolve + validate the episode/sequence chain against ``project``.

        Frontend contract (mirrors the mock adapter's episodic rules):
          * ``episode_id``/``sequence_id`` arrive as raw reference strings
            (UUID, code, or mock id) via the write-serializer aliases;
          * episodic projects REQUIRE an episode — missing or cleared
            episode on an episodic shot is a 400 ``episode_id`` error;
          * the episode is resolved inside the target project (codes repeat
            across projects); a foreign or unknown episode is "Unknown episode.";
          * a supplied ``sequence_id`` (id or code) must resolve to a sequence of the
            target project; the shot then points at it and ``sequence_code`` follows;
          * a shot follows the episode of its sequence when the sequence has one: an
            episode that differs is a 400, an omitted one is taken from the sequence.
            An older mismatch is left alone until the shot is moved (see the report).

        Errors use the standard DRF field-mapping shape, never a new
        contract. ``sequence_ref`` never reaches ``save()``.
        """
        data = serializer.validated_data if isinstance(serializer.validated_data, dict) else {}
        episode_supplied = "episode" in data
        raw_episode = data.get("episode") if episode_supplied else None
        raw_sequence = data.pop("sequence_ref", None)
        sequence_supplied = raw_sequence is not None

        if project is None:
            return

        sequence = instance.sequence if instance is not None else None
        if sequence_supplied:
            text = str(raw_sequence or "").strip()
            if text:
                sequence = SequenceSelector.resolve_in_project(project, text)
                if sequence is None:
                    raise ValidationError(
                        {"sequence_id": ["Unknown sequence for the selected project."]}
                    )
                data["sequence"] = sequence  # Shot.save() copies its code to sequence_code
            else:
                sequence = None
                data["sequence"] = None
                data["sequence_code"] = ""

        episode = None
        if episode_supplied:
            if isinstance(raw_episode, Episode) or str(raw_episode or "").strip():
                episode = EpisodeSelector.resolve_in_project(project, raw_episode)
                if episode is None:
                    raise ValidationError({"episode_id": ["Unknown episode."]})
            data["episode"] = episode
        elif instance is not None:
            episode = instance.episode

        # A shot follows the episode of its sequence (D-12). A sequence with no episode
        # (older rows, standard projects) leaves the shot's own episode as it is.
        if sequence is not None and sequence.episode_id is not None:  # pyright: ignore[reportAttributeAccessIssue]
            if episode_supplied and episode is not None and episode.pk != sequence.episode_id:  # pyright: ignore[reportAttributeAccessIssue]
                raise ValidationError(
                    {"episode_id": ["The episode must be the episode of the sequence."]}
                )
            if episode is None or sequence_supplied:
                data["episode"] = episode = sequence.episode

        if project.workflow_type == ProjectWorkflowType.EPISODIC and episode is None:
            raise ValidationError(
                {"episode_id": ["An episode is required for shots on episodic projects."]}
            )

    @extend_schema(responses=ShotAssetSerializer(many=True))
    @action(detail=True, methods=["get"], url_path="assets")
    def assets(self, request, *args, **kwargs):
        """The assets this shot uses (live links to live assets)."""
        shot = self.get_object()
        return Response(ShotAssetSerializer(ShotAssetSelector.for_shot(shot), many=True).data)

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
