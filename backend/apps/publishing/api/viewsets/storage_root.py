"""Storage root endpoints (docs/publishing/CONTRACTS.md API-PUB-12). Studio-wide."""

from __future__ import annotations

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform_crud import PlatformCrudViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.publishing.api.serializers.storage import StorageRootSerializer
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.selectors.files import StorageRootSelector
from apps.publishing.services.storage import StorageRootService


class StorageRootViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = StorageRootSelector
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission)
    serializer_map = {
        "list": StorageRootSerializer,
        "retrieve": StorageRootSerializer,
        "create": StorageRootSerializer,
        "update": StorageRootSerializer,
        "partial_update": StorageRootSerializer,
    }
    permission_map = {
        "list": (PublishPermissions.VIEW,),
        "retrieve": (PublishPermissions.VIEW,),
        "create": (PublishPermissions.STORAGE_MANAGE,),
        "update": (PublishPermissions.STORAGE_MANAGE,),
        "partial_update": (PublishPermissions.STORAGE_MANAGE,),
        "destroy": (PublishPermissions.STORAGE_MANAGE,),
    }

    def perform_destroy(self, instance):
        StorageRootService.delete(actor=self.request.user, root=instance)
