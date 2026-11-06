from rest_framework.decorators import action

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.sequence import SequenceFilterSet
from apps.production.api.serializers.sequence.create import SequenceCreateSerializer
from apps.production.api.serializers.sequence.detail import SequenceDetailSerializer
from apps.production.api.serializers.sequence.list import SequenceListSerializer
from apps.production.api.serializers.sequence.update import SequenceUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.api.viewsets.bulk import ProductionBulkMixin
from apps.production.constants.permissions import SequencePermissions
from apps.production.selectors.sequence import SequenceSelector
from apps.production.services.sequence import SequenceService
from apps.production.validators.episodic import apply_sequence_episode_rule


class SequenceViewSet(ProductionEntityViewSet, ProductionBulkMixin):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = SequenceSelector
    service_class = SequenceService
    pagination_class = StandardPagination
    filterset_class = SequenceFilterSet
    detail_serializer_class = SequenceDetailSerializer

    # CR-48: what bulk-update may change; never project, code, show, ownership or approval fields.
    bulk_update_fields = (
        "name",
        "description",
        "status",
        "episode_id",
        "frame_in",
        "frame_out",
        "department",
        "tags",
    )

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
        """The project's episode rule for a sequence (D-12; ``validators/episodic.py``)."""
        apply_sequence_episode_rule(data, project=project, creating=creating)
