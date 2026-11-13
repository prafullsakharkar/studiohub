"""
Published file registry endpoints (docs/publishing/CONTRACTS.md API-PUB-09 to API-PUB-12), and the
review-pipeline RP-4 reads: dependencies, the loader and resolve-path (C-RP-16 to C-RP-18).
"""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api.exceptions.api import NotFoundException
from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform_crud import PlatformReadViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.masterdata.selectors.catalog import MasterFileTypeSelector
from apps.production.selectors.asset import AssetSelector
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.shot import ShotSelector
from apps.production.selectors.task import TaskSelector
from apps.production.selectors.version import VersionSelector
from apps.publishing.api.serializers.file import (
    BulkRegisterSerializer,
    DependenciesSerializer,
    DependencyRowSerializer,
    DeprecateSerializer,
    LoaderQuerySerializer,
    LoaderRowSerializer,
    PublishedFileSerializer,
    RegisterFileSerializer,
    ResolvedPathSerializer,
    ResolvePathQuerySerializer,
    RestoreSerializer,
    RevokeSerializer,
)
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.domain.templates import TemplateError
from apps.publishing.models import PublishedFile
from apps.publishing.selectors.files import PublishedFileSelector
from apps.publishing.services.files import PublishedFileService
from apps.publishing.services.templates import resolve as resolve_template

_ENTITY_SELECTORS = {"shot": ShotSelector, "asset": AssetSelector, "task": TaskSelector}


def _in_reach(request, project_id) -> bool:
    """Files are read by full members only (SEC-PUB-01); platform admins reach every project."""
    visible = ProductionBaseSelector.visible_project_ids(request)
    return visible is None or project_id in visible


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
        "dependencies": (PublishPermissions.VIEW,),
        "loader": (PublishPermissions.VIEW,),
        "resolve_path": (PublishPermissions.VIEW,),
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

    @extend_schema(responses={200: DependenciesSerializer})
    @action(detail=True, methods=["get"], url_path="dependencies")
    def dependencies(self, request, *args, **kwargs):
        """The files this one was built from, and the files built from it (C-RP-16)."""
        links = PublishedFileSelector.dependencies(self.get_object())
        return Response(
            {side: DependencyRowSerializer(rows, many=True).data for side, rows in links.items()}
        )

    @extend_schema(
        parameters=[LoaderQuerySerializer],
        responses={200: LoaderRowSerializer(many=True)},
    )
    @action(detail=False, methods=["get"], url_path="loader", pagination_class=None)
    def loader(self, request, *args, **kwargs):
        """The latest, approved or hero file of each stream of a shot, asset or task (C-RP-17)."""
        query = LoaderQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        params = query.validated_data
        kind = next(name for name in _ENTITY_SELECTORS if params.get(name))
        project_ids = (
            _ENTITY_SELECTORS[kind]
            .get_queryset()
            .filter(pk=params[kind])
            .values_list("project_id", flat=True)
        )
        project_id = next(iter(project_ids), None)
        if project_id is None or not _in_reach(request, project_id):
            raise NotFoundException()
        rows = PublishedFileSelector.loader(
            kind=kind,
            entity_id=params[kind],
            role=params.get("role") or PublishedFile.Role.MAIN,
            which=params.get("which") or "latest",
            file_type=params.get("file_type") or "",
        )
        return Response(
            LoaderRowSerializer(rows, many=True, context=self.get_serializer_context()).data
        )

    @extend_schema(
        parameters=[ResolvePathQuerySerializer],
        responses={200: ResolvedPathSerializer},
    )
    @action(detail=False, methods=["get"], url_path="resolve-path")
    def resolve_path(self, request, *args, **kwargs):
        """Where a file of this version, type and role should be registered (C-RP-18)."""
        query = ResolvePathQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        params = query.validated_data
        version = (
            VersionSelector.get_queryset()
            .select_related(
                "project",
                "shot__sequence__episode",
                "shot__episode",
                "asset__asset_type",
                "task__sequence__episode",
            )
            .filter(pk=params["version_id"])
            .first()
        )
        if version is None or not _in_reach(request, version.project_id):  # pyright: ignore[reportAttributeAccessIssue]
            raise ValidationError({"version_id": ["Unknown version."]})
        file_type = MasterFileTypeSelector.resolve_active(params["file_type"])
        if file_type is None:
            raise ValidationError({"file_type": ["Unknown or inactive file type."]})
        try:
            resolved = resolve_template(
                version, file_type, params.get("role") or PublishedFile.Role.MAIN
            )
        except TemplateError as error:
            raise ValidationError({"version_id": [str(error)]}) from error
        if resolved is None:
            raise NotFoundException("No path template applies to this file type and role.")
        return Response(
            {
                "template_id": str(resolved.template.pk),
                "storage_root": resolved.storage_root.code,
                "pattern": resolved.template.pattern,
                "relative_path": resolved.relative_path,
                "enforce": resolved.template.enforce,
            }
        )
