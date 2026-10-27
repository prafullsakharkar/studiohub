"""Published file registry endpoints (docs/publishing/CONTRACTS.md API-PUB-09 to API-PUB-12)."""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform_crud import PlatformReadViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.publishing.api.serializers.file import (
    BulkRegisterSerializer,
    DeprecateSerializer,
    PublishedFileSerializer,
    RegisterFileSerializer,
    RestoreSerializer,
    RevokeSerializer,
)
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.selectors.files import PublishedFileSelector
from apps.publishing.services.files import PublishedFileService


class PublishedFileViewSet(PlatformReadViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Read, register and move published files. No update or delete: a registered file is immutable."""

    selector_class = PublishedFileSelector
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission)
    serializer_map = {"list": PublishedFileSerializer, "retrieve": PublishedFileSerializer}

    permission_map = {
        "list": (PublishPermissions.VIEW,),
        "retrieve": (PublishPermissions.VIEW,),
        "create": (PublishPermissions.CREATE,),
        "bulk_register": (PublishPermissions.CREATE,),
        "deprecate": (PublishPermissions.DEPRECATE,),
        "restore": (PublishPermissions.DEPRECATE,),
        "revoke": (PublishPermissions.REVOKE,),
    }

    ordering_fields = ("created_at", "relative_path", "status")

    def _present(self, file):
        return PublishedFileSerializer(file, context=self.get_serializer_context()).data

    @extend_schema(
        request=RegisterFileSerializer,
        responses={201: PublishedFileSerializer, 200: PublishedFileSerializer},
    )
    def create(self, request, *args, **kwargs):
        """Register one file of a published version (200 for an identical retry)."""
        body = RegisterFileSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        file, created = PublishedFileService.register(
            actor=request.user,
            request=request,
            version_id=body.validated_data["version_id"],
            data=body.validated_data,
        )
        return Response(
            self._present(file), status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @extend_schema(request=BulkRegisterSerializer, responses={200: dict, 207: dict})
    @action(detail=False, methods=["post"], url_path="bulk-register")
    def bulk_register(self, request, *args, **kwargs):
        """Register up to 100 files; each succeeds or fails alone (200 all ok, 207 otherwise)."""
        body = BulkRegisterSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        results = PublishedFileService.register_many(
            actor=request.user, request=request, items=body.validated_data["items"]
        )
        failed = sum(1 for result in results if not result["ok"])
        return Response(
            {
                "success": failed == 0,
                "succeeded_count": len(results) - failed,
                "failed_count": failed,
                "results": results,
            },
            status=status.HTTP_200_OK if failed == 0 else status.HTTP_207_MULTI_STATUS,
        )

    @extend_schema(request=DeprecateSerializer, responses={200: PublishedFileSerializer})
    @action(detail=True, methods=["post"], url_path="deprecate")
    def deprecate(self, request, *args, **kwargs):
        body = DeprecateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        file = PublishedFileService.deprecate(
            actor=request.user,
            request=request,
            file=self.get_object(),
            note=body.validated_data.get("note", ""),
            override_reason=body.validated_data.get("override_reason"),
        )
        return Response(self._present(file))

    @extend_schema(request=RestoreSerializer, responses={200: PublishedFileSerializer})
    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        body = RestoreSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        file = PublishedFileService.restore(
            actor=request.user,
            request=request,
            file=self.get_object(),
            override_reason=body.validated_data.get("override_reason"),
        )
        return Response(self._present(file))

    @extend_schema(request=RevokeSerializer, responses={200: PublishedFileSerializer})
    @action(detail=True, methods=["post"], url_path="revoke")
    def revoke(self, request, *args, **kwargs):
        body = RevokeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        file = PublishedFileService.revoke(
            actor=request.user,
            request=request,
            file=self.get_object(),
            reason=body.validated_data["reason"],
        )
        return Response(self._present(file))
