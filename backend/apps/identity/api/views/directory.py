"""
The directory (LDAP) settings: ``GET``/``PATCH /api/v1/identity/directory/``,
``POST …/test-connection/`` and ``POST …/test-user/`` (ADR-0039 decision 3), and linking an account
and syncing the directory accounts, ``POST …/link/`` and ``POST …/sync/`` (decisions 6 and 10,
CR-58; the same service as ``ldap_link`` and ``ldap_sync``).

Every action needs ``identity.directory.manage`` (the platform administrator).
"""

from __future__ import annotations

from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from apps.core.api.throttling import FailClosedScopedRateThrottle
from apps.core.api.viewsets.base import BaseViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.api.serializers.directory import (
    DirectoryConfigurationSerializer,
    DirectoryLinkSerializer,
    DirectorySyncSerializer,
    DirectoryTestUserSerializer,
)
from apps.identity.constants.permissions import DirectoryPermissions
from apps.identity.permissions import HasPermission
from apps.identity.services.directory.accounts import DirectoryAccountService
from apps.identity.services.directory.configuration import DirectoryConfigurationService


class DirectoryConfigurationViewSet(BaseViewSet):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_class = DirectoryConfigurationSerializer

    permission_map = {
        "retrieve": (DirectoryPermissions.MANAGE,),
        "partial_update": (DirectoryPermissions.MANAGE,),
        "test_connection": (DirectoryPermissions.MANAGE,),
        "test_user": (DirectoryPermissions.MANAGE,),
        "link": (DirectoryPermissions.MANAGE,),
        "sync": (DirectoryPermissions.MANAGE,),
    }

    def get_throttles(self) -> list[Any]:
        # These open outbound connections: rate them like other sensitive calls.
        if self.action in ("test_connection", "test_user", "link", "sync"):
            self.throttle_scope = "sensitive"
            return [FailClosedScopedRateThrottle()]
        return super().get_throttles()

    @extend_schema(responses=DirectoryConfigurationSerializer)
    def retrieve(self, request, *args, **kwargs):
        config = DirectoryConfigurationService.get()
        return Response(DirectoryConfigurationSerializer(config).data)

    @extend_schema(
        request=DirectoryConfigurationSerializer, responses=DirectoryConfigurationSerializer
    )
    def partial_update(self, request, *args, **kwargs):
        serializer = DirectoryConfigurationSerializer(
            DirectoryConfigurationService.get(), data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        config = DirectoryConfigurationService.update(
            actor=request.user, data=dict(serializer.validated_data)
        )
        return Response(DirectoryConfigurationSerializer(config).data)

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    def test_connection(self, request, *args, **kwargs):
        return Response(DirectoryConfigurationService.test_connection(actor=request.user))

    @extend_schema(request=DirectoryTestUserSerializer, responses=OpenApiTypes.OBJECT)
    def test_user(self, request, *args, **kwargs):
        serializer = DirectoryTestUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            DirectoryConfigurationService.test_user(username=serializer.validated_data["username"])
        )

    @extend_schema(request=DirectoryLinkSerializer, responses=OpenApiTypes.OBJECT)
    def link(self, request, *args, **kwargs):
        serializer = DirectoryLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = DirectoryAccountService.link(
            actor=request.user,
            email=serializer.validated_data["email"],
            username=serializer.validated_data["username"],
            dry_run=serializer.validated_data["dry_run"],
        )
        return Response(result.as_dict())

    @extend_schema(request=DirectorySyncSerializer, responses=OpenApiTypes.OBJECT)
    def sync(self, request, *args, **kwargs):
        serializer = DirectorySyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = DirectoryAccountService.sync(
            actor=request.user, dry_run=serializer.validated_data["dry_run"]
        )
        return Response(result.as_dict())
