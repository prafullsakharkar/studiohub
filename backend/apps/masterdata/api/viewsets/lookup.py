"""
Managed lookup-catalog viewsets (docs/masterdata/CONTRACTS.md §3).

One generic viewset serves the six type catalogs. Reads are open to every
authenticated user; every write needs ``masterdata.catalog.manage`` and a
hard delete also needs ``masterdata.hard_delete``. All state changes go
through ``apps.masterdata.services.catalog``; this module only adapts HTTP.

Responses keep the frontend contract: bare arrays (no pagination),
``{success, data}`` for archive/restore, ``{success, message}`` for DELETE.
"""

from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import filters, mixins, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.viewsets.base import BaseViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.masterdata.api.schema import (
    HARD_PARAMETER,
    ActionResultSerializer,
    MasterdataAutoSchema,
    SuccessMessageSerializer,
)
from apps.masterdata.api.serializers.catalog import (
    MasterAssetTypeSerializer,
    MasterFileTypeSerializer,
    MasterReviewTypeSerializer,
    MasterShotTypeSerializer,
    MasterStatusSerializer,
    MasterTaskTypeSerializer,
    ReorderSerializer,
    SoftwareSerializer,
    SoftwareVersionSerializer,
)
from apps.masterdata.constants.permissions import MasterdataPermissions
from apps.masterdata.models import MasterDataScope, Software
from apps.masterdata.selectors.catalog import (
    LookupSelector,
    MasterAssetTypeSelector,
    MasterFileTypeSelector,
    MasterReviewTypeSelector,
    MasterShotTypeSelector,
    MasterStatusSelector,
    MasterTaskTypeSelector,
    SoftwareSelector,
    SoftwareVersionSelector,
)
from apps.masterdata.services.catalog import (
    CatalogService,
    MasterAssetTypeService,
    MasterFileTypeService,
    MasterReviewTypeService,
    MasterShotTypeService,
    MasterStatusService,
    MasterTaskTypeService,
)
from apps.masterdata.services.software import SoftwareService, SoftwareVersionService

_TRUE = {"1", "true", "yes"}
_FALSE = {"", "0", "false", "no"}
_MANAGE = (MasterdataPermissions.CATALOG_MANAGE,)


class LookupCatalogViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    BaseViewSet,
):
    schema = MasterdataAutoSchema()
    permission_classes = (IsAuthenticatedPermission, HasPermission)
    permission_map = {
        "list": (),
        "retrieve": (),
        "create": _MANAGE,
        "update": _MANAGE,
        "partial_update": _MANAGE,
        "destroy": _MANAGE,
        "archive": _MANAGE,
        "restore": _MANAGE,
        "reorder": _MANAGE,
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    pagination_class = None
    service_class: type[CatalogService[Any]]
    selector_class: type[LookupSelector]
    label = "Record"

    # ---- hard delete flag --------------------------------------------------

    def _hard_requested(self) -> bool:
        return self.request.query_params.get("hard", "").strip().lower() in _TRUE

    def get_permission_required(self):
        if getattr(self, "action", None) == "destroy" and self._hard_requested():
            return (*_MANAGE, MasterdataPermissions.HARD_DELETE)
        return super().get_permission_required()

    # ---- queryset ----------------------------------------------------------

    def get_queryset(self):
        selector = self.selector_class
        # Restore and hard delete must reach soft-deleted rows; nothing else may.
        needs_deleted = self.action == "restore" or (
            self.action == "destroy" and self._hard_requested()
        )
        qs = (
            selector.with_deleted()
            if needs_deleted
            else selector.get_queryset(request=self.request, view=self)
        )
        # ``scope`` is a constant (DECISIONS D12): GLOBAL matches every row, anything else none.
        requested = self.request.query_params.get("scope", "").strip()
        if requested and requested != MasterDataScope.GLOBAL:
            return qs.none()
        return qs

    # ---- writes go through the service -----------------------------------

    def present(self, obj):
        """Return ``obj`` ready for the serializer (software re-reads it annotated)."""
        return obj

    def create_context(self) -> dict[str, Any]:
        """Extra service arguments for a create (versions: their software)."""
        return {}

    def perform_create(self, serializer):
        created = self.service_class.create(
            actor=self.request.user, data=serializer.validated_data, **self.create_context()
        )
        serializer.instance = self.present(created)

    def perform_update(self, serializer):
        instance = serializer.instance
        assert instance is not None  # an update always carries the row being updated
        updated = self.service_class.update(
            actor=self.request.user, instance=instance, data=serializer.validated_data
        )
        serializer.instance = self.present(updated)

    @extend_schema(request=None, responses={200: ActionResultSerializer})
    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        obj = self.service_class.archive(actor=request.user, instance=self.get_object())
        return Response({"success": True, "data": self.get_serializer(self.present(obj)).data})

    @extend_schema(request=None, responses={200: ActionResultSerializer})
    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        obj = self.service_class.restore(actor=request.user, instance=self.get_object())
        return Response({"success": True, "data": self.get_serializer(self.present(obj)).data})

    def update(self, request, *args, **kwargs):
        """PUT / PATCH. ``status`` is not writable here: it is changed only by the
        archive and restore actions, and soft delete is DELETE. Refusing it (instead
        of ignoring it) makes a client that still sends it fail loudly, even when the
        value is unchanged.
        """
        if hasattr(request.data, "keys") and "status" in request.data:
            raise serializers.ValidationError(
                {"status": ["Read-only. Use POST …/archive or …/restore to change it."]}
            )
        return super().update(request, *args, **kwargs)

    @extend_schema(
        parameters=[HARD_PARAMETER],
        responses={
            200: OpenApiResponse(SuccessMessageSerializer, description="Soft-deleted."),
            204: OpenApiResponse(description="Permanently deleted (`?hard=true`)."),
        },
    )
    def destroy(self, request, *args, **kwargs):
        hard = request.query_params.get("hard", "").strip().lower()
        if hard not in _TRUE | _FALSE:
            raise DjangoValidationError({"hard": ["Use hard=true or omit it."]})
        obj = self.get_object()
        if hard in _TRUE:
            self.service_class.hard_delete(actor=request.user, instance=obj)
            return Response(status=status.HTTP_204_NO_CONTENT)
        self.service_class.soft_delete(actor=request.user, instance=obj)
        # Soft delete only: the row is kept, hidden from lists and lookups, and
        # POST …/restore brings it back. The message says so (no "deleted" alone,
        # which reads as permanent). A permanent delete is DELETE ?hard=true.
        return Response(
            {"success": True, "message": f"{self.label} soft-deleted. It can be restored."},
            status=status.HTTP_200_OK,
        )

    @extend_schema(request=ReorderSerializer)
    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request, *args, **kwargs):
        body = ReorderSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        rows = self.service_class.reorder(
            actor=request.user, ordered_ids=body.validated_data["ids"]
        )
        return Response(self.get_serializer(rows, many=True).data)


class MasterStatusViewSet(LookupCatalogViewSet):
    serializer_class = MasterStatusSerializer
    selector_class = MasterStatusSelector
    service_class = MasterStatusService
    label = "Status"
    filterset_fields = ["entity_type", "status", "is_default", "is_final"]
    search_fields = ["name", "code"]
    ordering_fields = ["order", "name"]
    ordering = ["order", "name"]


class MasterTaskTypeViewSet(LookupCatalogViewSet):
    serializer_class = MasterTaskTypeSerializer
    selector_class = MasterTaskTypeSelector
    service_class = MasterTaskTypeService
    label = "Task type"
    filterset_fields = ["status", "category", "department_code"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "sort_order"]
    ordering = ["sort_order", "name"]


class MasterAssetTypeViewSet(LookupCatalogViewSet):
    serializer_class = MasterAssetTypeSerializer
    selector_class = MasterAssetTypeSelector
    service_class = MasterAssetTypeService
    label = "Asset type"
    filterset_fields = ["status"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "sort_order"]
    ordering = ["sort_order", "name"]


class MasterShotTypeViewSet(LookupCatalogViewSet):
    serializer_class = MasterShotTypeSerializer
    selector_class = MasterShotTypeSelector
    service_class = MasterShotTypeService
    label = "Shot type"
    filterset_fields = ["status"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "sort_order"]
    ordering = ["sort_order", "name"]


class MasterReviewTypeViewSet(LookupCatalogViewSet):
    serializer_class = MasterReviewTypeSerializer
    selector_class = MasterReviewTypeSelector
    service_class = MasterReviewTypeService
    label = "Review type"
    filterset_fields = ["status"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "sort_order"]
    ordering = ["sort_order", "name"]


class MasterFileTypeViewSet(LookupCatalogViewSet):
    serializer_class = MasterFileTypeSerializer
    selector_class = MasterFileTypeSelector
    service_class = MasterFileTypeService
    label = "File type"
    filterset_fields = ["status", "category"]
    search_fields = ["name", "extension"]
    ordering_fields = ["name", "sort_order"]
    ordering = ["sort_order", "name"]


class SoftwareViewSet(LookupCatalogViewSet):
    serializer_class = SoftwareSerializer
    selector_class = SoftwareSelector
    service_class: type[SoftwareService] = SoftwareService  # narrower: archive() takes ``cascade``
    label = "Software"
    filterset_fields = ["status", "category"]
    search_fields = ["name", "code", "publisher"]
    ordering_fields = ["name", "sort_order", "created_at", "updated_at"]
    ordering = ["sort_order", "name"]

    def get_queryset(self):
        # One query for every row's version_count (no per-row count).
        return SoftwareSelector.annotate_version_count(super().get_queryset())

    def present(self, obj):
        return self.get_queryset().get(pk=obj.pk)

    @extend_schema(
        request=None,
        parameters=[OpenApiParameter("cascade", bool, required=False)],
        responses={200: ActionResultSerializer},
    )
    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        """Archive the software and, unless ``?cascade=false``, its active versions."""
        raw = request.query_params.get("cascade", "true").strip().lower()
        if raw not in _TRUE | _FALSE:
            raise DjangoValidationError({"cascade": ["Use cascade=true or cascade=false."]})
        obj = self.service_class.archive(
            actor=request.user, instance=self.get_object(), cascade=raw not in _FALSE
        )
        data = dict(self.get_serializer(self.present(obj)).data)
        data["versions_archived"] = getattr(obj, "versions_archived", [])
        return Response({"success": True, "data": data})


class SoftwareVersionViewSet(LookupCatalogViewSet):
    serializer_class = SoftwareVersionSerializer
    selector_class = SoftwareVersionSelector
    service_class = SoftwareVersionService
    label = "Software version"
    filterset_fields = ["status"]
    search_fields = ["version", "version_code", "name"]
    ordering_fields = ["version", "release_date", "sort_order"]
    # Default order comes from the model: newest release first, undated last,
    # then the natural version order (DOM-MD-SW-06).
    ordering = None

    def _software(self) -> Software:
        return get_object_or_404(Software.objects.all(), pk=self.kwargs["software_pk"])

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self, "swagger_fake_view", False):
            return queryset.none()
        return queryset.filter(software=self._software())

    def create_context(self) -> dict[str, Any]:
        return {"parent": self._software()}
