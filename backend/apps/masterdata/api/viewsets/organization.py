"""
Organization master-data endpoints.

Implements the organization-scoped effective master-data contract:

- GET  ``organizations/{organization_id}/master-data/bundle``
- GET  ``organizations/{organization_id}/master-data/{data_type}``
- PUT  ``organizations/{organization_id}/master-data/{data_type}/{item_id}/config``
- POST ``organizations/{organization_id}/master-data/{data_type}/custom``

Organization isolation is enforced on the backend: every request must belong
to the organization (via a non-deleted membership) before any data is
returned. Writes additionally require the corresponding RBAC permission code.
"""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from apps.core.api.viewsets.base import BaseViewSet
from apps.masterdata.api.serializers.catalog import (
    MasterAssetTypeSerializer,
    MasterFileTypeSerializer,
    MasterReviewTypeSerializer,
    MasterShotTypeSerializer,
    MasterStatusSerializer,
    MasterTaskTypeSerializer,
    SoftwareSerializer,
)
from apps.masterdata.api.serializers.config import (
    OrganizationAssetTypeConfigSerializer,
    OrganizationFileTypeConfigSerializer,
    OrganizationReviewTypeConfigSerializer,
    OrganizationShotTypeConfigSerializer,
    OrganizationSoftwareConfigSerializer,
    OrganizationStatusConfigSerializer,
    OrganizationTaskTypeConfigSerializer,
)
from apps.masterdata.models import (
    MasterAssetType,
    MasterDataScope,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
    OrganizationAssetTypeConfig,
    OrganizationFileTypeConfig,
    OrganizationReviewTypeConfig,
    OrganizationShotTypeConfig,
    OrganizationSoftwareConfig,
    OrganizationStatusConfig,
    OrganizationTaskTypeConfig,
    Software,
)
from apps.masterdata.services.resolution import (
    resolve_asset_type_bundle,
    resolve_file_type_bundle,
    resolve_master_bundle,
    resolve_review_type_bundle,
    resolve_shot_type_bundle,
    resolve_software_bundle,
    resolve_status_bundle,
    resolve_task_type_bundle,
)


class OrganizationMasterDataViewSet(BaseViewSet):
    pagination_class = None

    RESOLVERS = {
        "software": resolve_software_bundle,
        "statuses": resolve_status_bundle,
        "task-types": resolve_task_type_bundle,
        "asset-types": resolve_asset_type_bundle,
        "shot-types": resolve_shot_type_bundle,
        "review-types": resolve_review_type_bundle,
        "file-types": resolve_file_type_bundle,
    }

    CONFIG_MAP = {
        "software": (OrganizationSoftwareConfig, OrganizationSoftwareConfigSerializer, "software_id", Software),
        "statuses": (OrganizationStatusConfig, OrganizationStatusConfigSerializer, "status_item_id", MasterStatus),
        "task-types": (OrganizationTaskTypeConfig, OrganizationTaskTypeConfigSerializer, "task_type_id", MasterTaskType),
        "asset-types": (OrganizationAssetTypeConfig, OrganizationAssetTypeConfigSerializer, "asset_type_id", MasterAssetType),
        "shot-types": (OrganizationShotTypeConfig, OrganizationShotTypeConfigSerializer, "shot_type_id", MasterShotType),
        "review-types": (OrganizationReviewTypeConfig, OrganizationReviewTypeConfigSerializer, "review_type_id", MasterReviewType),
        "file-types": (OrganizationFileTypeConfig, OrganizationFileTypeConfigSerializer, "file_type_id", MasterFileType),
    }

    CREATE_MAP = {
        "software": SoftwareSerializer,
        "statuses": MasterStatusSerializer,
        "task-types": MasterTaskTypeSerializer,
        "asset-types": MasterAssetTypeSerializer,
        "shot-types": MasterShotTypeSerializer,
        "review-types": MasterReviewTypeSerializer,
        "file-types": MasterFileTypeSerializer,
    }

    CONFIG_PERMISSION = "organization.master_data.configure"
    CREATE_PERMISSION = "organization.master_data.create"

    @staticmethod
    def _get_organization(organization_id):
        from apps.organization.models import Organization

        try:
            return Organization.objects.get(id=organization_id)
        except Organization.DoesNotExist:  # pyright: ignore[reportAttributeAccessIssue]
            raise NotFound({"detail": "Organization not found."}) from None

    def _require_organization_access(self, organization):
        user = getattr(self.request, "user", None)
        if user is not None and getattr(user, "is_superuser", False):
            # Spec §1 core rule: superusers access all organizations
            # (break-glass, no membership required).
            return
        from apps.organization.models import OrganizationMembership

        has_access = OrganizationMembership.objects.filter(
            organization=organization,
            user=self.request.user,
            is_deleted=False,
        ).exists()
        if not has_access:
            raise PermissionDenied({"detail": "Access to this organization denied."})

    @staticmethod
    def _require_permission(user, organization, code, message):
        from apps.identity.services.permission_cache import PermissionCacheService

        allowed = PermissionCacheService.has_permission(
            user=user,
            permission=code,
            organization=organization,
        )
        if not allowed:
            raise PermissionDenied({"detail": message})

    @staticmethod
    def _writable_defaults(serializer_class, data):
        read_only = set(serializer_class.Meta.read_only_fields)
        defaults = {}
        for field_name in serializer_class().fields:
            if field_name in read_only:
                continue
            if field_name in data:
                defaults[field_name] = data[field_name]
        return defaults

    @action(detail=False, methods=["get"])
    def bundle(self, request, organization_id=None):
        organization = self._get_organization(organization_id)
        self._require_organization_access(organization)
        return Response(resolve_master_bundle(organization))

    @action(detail=False, methods=["get"])
    def list_type(self, request, organization_id=None, data_type=None):
        assert data_type is not None
        organization = self._get_organization(organization_id)
        # ADR-0033: organization master data always requires org membership —
        # no per-type bypass (previously file-types skipped this check).
        self._require_organization_access(organization)
        resolver = self.RESOLVERS.get(data_type)
        if resolver is None:
            raise NotFound({"detail": "Unknown master data type."})
        return Response(resolver(organization))

    @action(detail=False, methods=["put"])
    def update_config(self, request, organization_id=None, data_type=None, item_id=None):
        assert data_type is not None and item_id is not None
        organization = self._get_organization(organization_id)
        self._require_organization_access(organization)
        self._require_permission(
            request.user,
            organization,
            self.CONFIG_PERMISSION,
            "Permission denied: cannot configure organization master data.",
        )

        entry = self.CONFIG_MAP.get(data_type)
        if entry is None:
            raise NotFound({"detail": "Unknown master data type."})
        config_model, serializer_class, fk_field, parent_model = entry

        get_object_or_404(parent_model.objects.all(), id=item_id)

        data = request.data
        if (
            data_type == "software"
            and "executable_path_overrides" in data
            and "executable_paths" not in data
        ):
            data = dict(data)
            data["executable_paths"] = data.pop("executable_path_overrides")

        defaults = self._writable_defaults(serializer_class, data)
        config, _created = config_model.objects.update_or_create(
            organization=organization,
            **{fk_field: item_id},
            defaults=defaults,
        )
        return Response(dict(serializer_class(config).data))

    @action(detail=False, methods=["post"])
    def create_custom(self, request, organization_id=None, data_type=None):
        assert data_type is not None
        organization = self._get_organization(organization_id)
        self._require_organization_access(organization)
        self._require_permission(
            request.user,
            organization,
            self.CREATE_PERMISSION,
            "Permission denied: cannot create custom master records.",
        )

        serializer_class = self.CREATE_MAP.get(data_type)
        if serializer_class is None:
            raise NotFound({"detail": "Unknown master data type."})

        serializer = serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(scope=MasterDataScope.ORGANIZATION, organization=organization)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def bulk_enable(self, request, organization_id=None, data_type=None):
        import uuid as _uuid

        from django.db import transaction

        assert data_type is not None
        organization = self._get_organization(organization_id)
        self._require_organization_access(organization)
        self._require_permission(
            request.user,
            organization,
            self.CONFIG_PERMISSION,
            "Permission denied: cannot configure organization master data.",
        )

        entry = self.CONFIG_MAP.get(data_type)
        if entry is None:
            raise NotFound({"detail": "Unknown master data type."})
        config_model, _serializer_class, fk_field, parent_model = entry

        raw_ids = (request.data or {}).get("ids", [])
        if not isinstance(raw_ids, list) or not all(isinstance(v, str) for v in raw_ids):
            return Response({"detail": "ids must be a list of UUID strings."}, status=400)
        try:
            parsed = [_uuid.UUID(v) for v in raw_ids]
        except (ValueError, AttributeError):
            return Response({"detail": "ids must be a list of UUID strings."}, status=400)
        valid = (
            parent_model.objects.filter(id__in=parsed).values_list("id", flat=True)
            if raw_ids
            else []
        )
        valid_set = set(valid)
        enabled, existing = [], []
        with transaction.atomic():
            for raw, parsed_id in zip(raw_ids, parsed):
                if parsed_id not in valid_set:
                    continue
                obj, created = config_model.objects.get_or_create(
                    organization=organization,
                    **{fk_field: parsed_id},
                    defaults={"enabled": True},
                )
                if created:
                    enabled.append(raw)
                elif not obj.enabled:
                    obj.enabled = True
                    obj.save(update_fields=["enabled"])
                    enabled.append(raw)
                else:
                    existing.append(raw)
        return Response(
            {
                "enabled_count": len(enabled),
                "existing_count": len(existing),
                "enabled": enabled,
                "existing": existing,
                "message": (
                    "Master records enabled successfully."
                    if enabled
                    else "All selected records are already enabled for this organization."
                ),
            }
        )
