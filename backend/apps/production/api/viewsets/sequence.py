from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.sequence import SequenceFilterSet
from apps.production.api.serializers.sequence.bulk import (
    SequenceBulkCreateSerializer,
    SequenceBulkUpdateItemSerializer,
)
from apps.production.api.serializers.sequence.create import SequenceCreateSerializer
from apps.production.api.serializers.sequence.detail import SequenceDetailSerializer
from apps.production.api.serializers.sequence.list import SequenceListSerializer
from apps.production.api.serializers.sequence.update import SequenceUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import SequencePermissions
from apps.production.models import Sequence
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.sequence import SequenceSelector
from apps.production.services.sequence import SequenceService


class SequenceViewSet(ProductionEntityViewSet):
    selector_class = SequenceSelector
    service_class = SequenceService
    pagination_class = StandardPagination
    filterset_class = SequenceFilterSet

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
        "existence_check": (SequencePermissions.CREATE,),
        "restore": (SequencePermissions.UPDATE,),
        "archived": (SequencePermissions.VIEW,),
    }

    search_fields = ("code", "name", "description", "department")
    ordering_fields = ("code", "name", "created_at", "status")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _organization(self):
        org = getattr(self.request, "organization", None)
        if org is None:
            raise ValidationError({"organization": "An active organization is required."})
        return org

    def _bulk_response(self, results):
        """Build the bulk response envelope with per-result entity serialization."""
        context = self.get_serializer_context()
        output = []
        successful = 0
        for result in results:
            item = {k: v for k, v in result.items() if k != "entity"}
            if result.get("entity") is not None:
                item["entity"] = SequenceDetailSerializer(
                    result["entity"],
                    context=context,
                ).data
            if result["status"] in (
                SequenceService.CREATED,
                SequenceService.UPDATED,
                SequenceService.ARCHIVED,
                SequenceService.RESTORED,
            ):
                successful += 1
            output.append(item)
        return Response(
            {
                "processed": len(results),
                "successful": successful,
                "failed": len(results) - successful,
                "results": output,
            }
        )

    def _items_list(self):
        items = self.request.data.get("items", [])
        if not isinstance(items, list):
            raise ValidationError({"items": "Must be a list."})
        return items

    def _ids_list(self):
        ids = self.request.data.get("ids", [])
        if not isinstance(ids, list):
            raise ValidationError({"ids": "Must be a list."})
        return ids

    # ------------------------------------------------------------------
    # Bulk actions
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

    @action(detail=False, methods=["post"], url_path="existence-check")
    def existence_check(self, request):
        items = self._items_list()
        results = self.service_class.bulk_check_existence(
            items,
            organization=self._organization(),
        )
        return Response({"results": results})

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        serializer = SequenceBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data["items"]
        results = self.service_class.bulk_create(
            items,
            organization=self._organization(),
            user=request.user,
        )
        return self._bulk_response(results)

    @action(detail=False, methods=["patch"], url_path="bulk-update")
    def bulk_update(self, request):
        serializer = SequenceBulkUpdateItemSerializer(
            data=self._items_list(),
            many=True,
        )
        serializer.is_valid(raise_exception=True)
        results = self.service_class.bulk_update(
            serializer.validated_data,
            organization=self._organization(),
            user=request.user,
        )
        return self._bulk_response(results)

    @action(detail=False, methods=["post"], url_path="bulk-archive")
    def bulk_archive(self, request):
        results = self.service_class.bulk_archive(
            self._ids_list(),
            organization=self._organization(),
            user=request.user,
        )
        return self._bulk_response(results)

    @action(detail=False, methods=["post"], url_path="bulk-restore")
    def bulk_restore(self, request):
        results = self.service_class.bulk_restore(
            self._ids_list(),
            organization=self._organization(),
            user=request.user,
        )
        return self._bulk_response(results)

    # ------------------------------------------------------------------
    # Single restore
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        seq_id = kwargs.get("uuid") or kwargs.get("pk")
        org = self._organization()
        instance = Sequence.all_objects.filter(
            organization=org,
            id=seq_id,
        ).first()
        if instance is None or not instance.is_deleted:
            raise NotFound("Sequence not found.")
        self.service_class.restore(instance)
        return Response(
            SequenceDetailSerializer(
                instance,
                context=self.get_serializer_context(),
            ).data
        )
