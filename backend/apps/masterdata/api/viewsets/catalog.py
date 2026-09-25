"""
Masterdata catalog viewsets.

Implements the global (platform) master-data catalog contract:

- Platform catalog CRUD, soft-archive and restore per type.
- Nested software versions.
- Platform overview statistics.

These endpoints are ``scope=GLOBAL`` only and return bare arrays
(no pagination) to match the frontend mock contract.
"""

from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.viewsets.base import BaseViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.masterdata.api.serializers.catalog import (
    MasterAssetTypeSerializer,
    MasterFileTypeSerializer,
    MasterReviewTypeSerializer,
    MasterShotTypeSerializer,
    MasterStatusSerializer,
    MasterTaskTypeSerializer,
    SoftwareSerializer,
    SoftwareVersionSerializer,
)
from apps.masterdata.api.serializers.platform import (
    PlatformDepartmentSerializer,
    PlatformGroupSerializer,
    PlatformPositionSerializer,
    PlatformRoleSerializer,
)
from apps.masterdata.models import MasterDataScope
from apps.masterdata.selectors.catalog import (
    MasterAssetTypeSelector,
    MasterFileTypeSelector,
    MasterReviewTypeSelector,
    MasterShotTypeSelector,
    MasterStatusSelector,
    MasterTaskTypeSelector,
    PlatformDepartmentSelector,
    PlatformGroupSelector,
    PlatformPositionSelector,
    PlatformRoleSelector,
    SoftwareSelector,
    SoftwareVersionSelector,
)
from apps.masterdata.services.resolution import (
    get_platform_overview,
)
from apps.platform.constants.permissions import PlatformMasterDataPermissions


class MasterDataCatalogGuard:
    """
    Global master-data catalog gate (ADR-0033 D4).

    Reads stay open to every authenticated user (the catalog is shared
    reference data); state-changing actions require the platform-level
    ``platform.master_data.configure`` grant instead of Django staff status.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (PlatformMasterDataPermissions.CONFIGURE,),
        "update": (PlatformMasterDataPermissions.CONFIGURE,),
        "partial_update": (PlatformMasterDataPermissions.CONFIGURE,),
        "destroy": (PlatformMasterDataPermissions.CONFIGURE,),
        "archive": (PlatformMasterDataPermissions.CONFIGURE,),
        "restore": (PlatformMasterDataPermissions.CONFIGURE,),
    }


class ArchiveRestoreMixin:
    """Soft-archive / restore lifecycle for catalog records.

    - ``POST <detail>/archive`` sets ``status="archived"``.
    - ``POST <detail>/restore`` sets ``status="active"``.
    - ``DELETE <detail>`` soft-deletes via ``status="archived"``.

    The archive/restore actions return ``{success, data}``; DELETE returns
    ``{success, message}`` (matching the frontend API contract).
    """

    archive_message = "Record archived."

    def _set_status(self, value: str) -> Response:
        obj = self.get_object()  # pyright: ignore[reportAttributeAccessIssue]
        obj.status = value
        obj.save()
        return Response({"success": True, "data": self.get_serializer(obj).data})  # pyright: ignore[reportAttributeAccessIssue]

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        return self._set_status("archived")

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        return self._set_status("active")

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()  # pyright: ignore[reportAttributeAccessIssue]
        obj.status = "archived"
        obj.save()
        return Response(
            {"success": True, "message": self.archive_message},
            status=status.HTTP_200_OK,
        )


class SoftwareViewSet(MasterDataCatalogGuard, ArchiveRestoreMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = SoftwareSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "scope", "category"]
    search_fields = ["name", "code", "publisher"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name"]
    pagination_class = None
    archive_message = "Software archived."

    def get_queryset(self):
        return SoftwareSelector.get_queryset(
            request=self.request,
            view=self,
        ).filter(scope=MasterDataScope.GLOBAL)


class SoftwareVersionViewSet(MasterDataCatalogGuard, ArchiveRestoreMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = SoftwareVersionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "scope"]
    search_fields = ["version", "version_code"]
    ordering_fields = ["version", "release_date"]
    ordering = ["-release_date"]
    pagination_class = None

    def get_queryset(self):
        queryset = SoftwareVersionSelector.get_queryset(
            request=self.request,
            view=self,
        ).filter(scope=MasterDataScope.GLOBAL)
        software_pk = self.kwargs.get("software_pk")
        if software_pk:
            queryset = queryset.filter(software_id=software_pk)
        return queryset


class MasterStatusViewSet(MasterDataCatalogGuard, ArchiveRestoreMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = MasterStatusSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["entity_type", "status", "scope", "is_default", "is_final"]
    search_fields = ["name", "code"]
    ordering_fields = ["order", "name"]
    ordering = ["order", "name"]
    pagination_class = None

    def get_queryset(self):
        return MasterStatusSelector.get_queryset(
            request=self.request,
            view=self,
        ).filter(scope=MasterDataScope.GLOBAL)


class MasterTaskTypeViewSet(MasterDataCatalogGuard, ArchiveRestoreMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = MasterTaskTypeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "scope", "category", "department_code"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code"]
    ordering = ["name"]
    pagination_class = None

    def get_queryset(self):
        return MasterTaskTypeSelector.get_queryset(
            request=self.request,
            view=self,
        ).filter(scope=MasterDataScope.GLOBAL)


class MasterAssetTypeViewSet(MasterDataCatalogGuard, ArchiveRestoreMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = MasterAssetTypeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "scope"]
    search_fields = ["name", "code"]
    ordering_fields = ["name"]
    ordering = ["name"]
    pagination_class = None

    def get_queryset(self):
        return MasterAssetTypeSelector.get_queryset(
            request=self.request,
            view=self,
        ).filter(scope=MasterDataScope.GLOBAL)


class MasterShotTypeViewSet(MasterDataCatalogGuard, ArchiveRestoreMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = MasterShotTypeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "scope"]
    search_fields = ["name", "code"]
    ordering_fields = ["name"]
    ordering = ["name"]
    pagination_class = None

    def get_queryset(self):
        return MasterShotTypeSelector.get_queryset(
            request=self.request,
            view=self,
        ).filter(scope=MasterDataScope.GLOBAL)


class MasterReviewTypeViewSet(MasterDataCatalogGuard, ArchiveRestoreMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = MasterReviewTypeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "scope"]
    search_fields = ["name", "code"]
    ordering_fields = ["name"]
    ordering = ["name"]
    pagination_class = None

    def get_queryset(self):
        return MasterReviewTypeSelector.get_queryset(
            request=self.request,
            view=self,
        ).filter(scope=MasterDataScope.GLOBAL)


class MasterFileTypeViewSet(MasterDataCatalogGuard, ArchiveRestoreMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = MasterFileTypeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "scope", "category"]
    search_fields = ["name", "extension"]
    ordering_fields = ["name"]
    ordering = ["name"]
    pagination_class = None

    def get_queryset(self):
        return MasterFileTypeSelector.get_queryset(
            request=self.request,
            view=self,
        ).filter(scope=MasterDataScope.GLOBAL)


class PlatformRoleViewSet(MasterDataCatalogGuard, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = PlatformRoleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["scope", "is_system"]
    search_fields = ["name", "code"]
    ordering_fields = ["name"]
    ordering = ["name"]
    pagination_class = None

    def get_queryset(self):
        return PlatformRoleSelector.get_queryset(request=self.request, view=self)


class PlatformGroupViewSet(MasterDataCatalogGuard, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = PlatformGroupSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = []
    search_fields = ["name", "code"]
    ordering_fields = ["name"]
    ordering = ["name"]
    pagination_class = None

    def get_queryset(self):
        return PlatformGroupSelector.get_queryset(request=self.request, view=self)


class PlatformDepartmentViewSet(MasterDataCatalogGuard, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = PlatformDepartmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = []
    search_fields = ["name", "code"]
    ordering_fields = ["name"]
    ordering = ["name"]
    pagination_class = None

    def get_queryset(self):
        return PlatformDepartmentSelector.get_queryset(request=self.request, view=self)


class PlatformPositionViewSet(MasterDataCatalogGuard, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, BaseViewSet):
    serializer_class = PlatformPositionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "department"]
    search_fields = ["title", "code"]
    ordering_fields = ["title"]
    ordering = ["title"]
    pagination_class = None

    def get_queryset(self):
        return PlatformPositionSelector.get_queryset(request=self.request, view=self)


class PlatformOverviewViewSet(BaseViewSet):
    pagination_class = None

    @action(detail=False, methods=["get"], url_path="overview")
    def overview(self, request):
        return Response(get_platform_overview())
