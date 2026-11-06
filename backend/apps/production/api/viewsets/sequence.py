from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.sequence import SequenceFilterSet
from apps.production.api.serializers.sequence.create import SequenceCreateSerializer
from apps.production.api.serializers.sequence.detail import SequenceDetailSerializer
from apps.production.api.serializers.sequence.list import SequenceListSerializer
from apps.production.api.serializers.sequence.update import SequenceUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.api.viewsets.bulk import ProductionBulkMixin
from apps.production.constants import ProjectWorkflowType
from apps.production.constants.permissions import SequencePermissions
from apps.production.models import Episode
from apps.production.selectors.episode import EpisodeSelector
from apps.production.selectors.sequence import SequenceSelector
from apps.production.services.sequence import SequenceService


class SequenceViewSet(ProductionEntityViewSet, ProductionBulkMixin):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = SequenceSelector
    service_class = SequenceService
    pagination_class = StandardPagination
    filterset_class = SequenceFilterSet
    detail_serializer_class = SequenceDetailSerializer

    serializer_map = {
        "list": SequenceListSerializer,
        "retrieve": SequenceDetailSerializer,
        "create": SequenceCreateSerializer,
        "update": SequenceUpdateSerializer,
        "partial_update": SequenceUpdateSerializer,
    }

    permission_map = {
        "list": (SequencePermissions.VIEW,),
        "retrieve": (SequencePermissions.VIEW,),
        "create": (SequencePermissions.CREATE,),
        "update": (SequencePermissions.UPDATE,),
        "partial_update": (SequencePermissions.UPDATE,),
        "destroy": (SequencePermissions.DELETE,),
        "bulk_create": (SequencePermissions.CREATE,),
        "bulk_update": (SequencePermissions.UPDATE,),
        "bulk_archive": (SequencePermissions.DELETE,),
        "bulk_restore": (SequencePermissions.UPDATE,),
        "check_existence": (SequencePermissions.CREATE,),
        "existence_check": (SequencePermissions.CREATE,),
        "archive": (SequencePermissions.DELETE,),
        "restore": (SequencePermissions.UPDATE,),
        "archived": (SequencePermissions.VIEW,),
    }

    search_fields = ("code", "name", "description", "department", "lead_artist_name")
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
        data = serializer.validated_data if isinstance(serializer.validated_data, dict) else {}
        self._enforce_episode_rule(data, project=project, creating=True)

    def prepare_update(self, instance, data):
        self._enforce_episode_rule(data, project=instance.project, creating=False)

    def _enforce_episode_rule(self, data, *, project, creating):
        """
        The project's episode rule for a sequence (D-12).

        * Episodic project: a new sequence needs an episode of that project. An existing
          sequence keeps what it has (older rows may have none) but cannot be cleared.
        * Standard project: no episode; sending one is a 400, sending an empty value is fine.

        The episode is looked up inside the project, so one of another project reads like
        one that does not exist.
        """
        if project is None:
            return
        supplied = "episode" in data
        raw = data.get("episode") if supplied else None
        given = isinstance(raw, Episode) or bool(str(raw or "").strip())

        if project.workflow_type != ProjectWorkflowType.EPISODIC:
            if given:
                raise ValidationError(
                    {"episode_id": ["Episodes are not used on standard projects."]}
                )
            if supplied:
                data["episode"] = None
            return

        if not supplied:
            if creating:
                raise ValidationError(
                    {"episode_id": ["An episode is required for sequences on episodic projects."]}
                )
            return
        if not given:
            raise ValidationError(
                {"episode_id": ["An episode is required for sequences on episodic projects."]}
            )
        episode = EpisodeSelector.resolve_in_project(project, raw)
        if episode is None:
            raise ValidationError({"episode_id": ["Unknown episode."]})
        data["episode"] = episode
