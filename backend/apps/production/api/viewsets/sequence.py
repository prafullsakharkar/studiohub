from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.mixins.bulk import BulkActionsMixin
from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.sequence import SequenceFilterSet
from apps.production.api.serializers.sequence.create import SequenceCreateSerializer
from apps.production.api.serializers.sequence.detail import SequenceDetailSerializer
from apps.production.api.serializers.sequence.list import SequenceListSerializer
from apps.production.api.serializers.sequence.update import SequenceUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import SequencePermissions
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.sequence import SequenceSelector
from apps.production.services.sequence import SequenceService


class SequenceViewSet(BulkActionsMixin, ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
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

    # ------------------------------------------------------------------
    # Bulk fetch (for archive/restore UI)
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"], url_path="archived")
    def archived(self, request):
        qs = self.service_class.get_archived(
            organization=self._organization(),
            project_id=request.query_params.get("project_id"),
        )
        qs = ProductionBaseSelector.scope_by_request(qs, request=request, view=self)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
