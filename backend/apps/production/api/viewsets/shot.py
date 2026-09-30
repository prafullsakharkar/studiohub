from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api.mixins.bulk import BulkActionsMixin
from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.shot import ShotFilterSet
from apps.production.api.serializers.shot.create import ShotCreateSerializer
from apps.production.api.serializers.shot.detail import ShotDetailSerializer
from apps.production.api.serializers.shot.list import ShotListSerializer
from apps.production.api.serializers.shot.update import ShotUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants import ProjectWorkflowType
from apps.production.constants.permissions import ShotPermissions
from apps.production.models import Episode
from apps.production.selectors.episode import EpisodeSelector
from apps.production.selectors.sequence import SequenceSelector
from apps.production.selectors.shot import ShotSelector
from apps.production.services.shot import ShotService


class ShotViewSet(BulkActionsMixin, ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
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
    }

    search_fields = ("code", "name", "description", "sequence_code")
    ordering_fields = ("code", "name", "created_at", "status")

    def perform_create(self, serializer):
        validated = serializer.validated_data
        data = validated if isinstance(validated, dict) else {}
        project = data.get("project")
        if project is None or isinstance(project, str):
            project = self._resolve_project_from_input(serializer)
        self._enforce_episode_sequence_chain(
            serializer, project=project, instance=None
        )
        super().perform_create(serializer)

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
          * the episode must belong to the target project;
          * a supplied ``sequence_id`` must resolve to a sequence of the
            target project and normalizes the stored ``sequence_code``.

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

        episode = None
        if episode_supplied:
            if isinstance(raw_episode, Episode):
                episode = raw_episode
            else:
                text = str(raw_episode or "").strip()
                if text:
                    episode = EpisodeSelector.resolve_by_lookup(
                        self.resolve_organization(instance=instance), text
                    )
                    if episode is None:
                        raise ValidationError({"episode_id": ["Unknown episode."]})
            if episode is not None and episode.project_id != project.id:
                raise ValidationError(
                    {"episode_id": ["Episode does not belong to the selected project."]}
                )
            data["episode"] = episode
        elif instance is not None:
            episode = instance.episode

        if project.workflow_type == ProjectWorkflowType.EPISODIC and episode is None:
            raise ValidationError(
                {"episode_id": ["An episode is required for shots on episodic projects."]}
            )

        if sequence_supplied:
            text = str(raw_sequence or "").strip()
            if text:
                sequence = SequenceSelector.resolve_in_project(project, text)
                if sequence is None:
                    raise ValidationError(
                        {"sequence_id": ["Unknown sequence for the selected project."]}
                    )
                data["sequence_code"] = sequence.code
            else:
                data["sequence_code"] = ""

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.status = "Approved"
        instance.supervisor_approved = True
        if instance.pipeline:
            for k in instance.pipeline:
                instance.pipeline[k] = "Approved"
        instance.save(update_fields=["status", "supervisor_approved", "pipeline"])
        serializer = ShotDetailSerializer(instance)
        return Response(serializer.data)
