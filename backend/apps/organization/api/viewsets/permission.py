"""
Permission API viewset.
"""

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.permission import PermissionFilterSet
from apps.organization.api.serializers.permission import (
    PermissionCreateSerializer,
    PermissionDetailSerializer,
    PermissionListSerializer,
    PermissionUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.api.viewsets.compat import IdOrCodeDetailMixin
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import PermissionPermissions
from apps.organization.models.permission import Permission
from apps.organization.selectors.permission import PermissionSelector
from apps.organization.services.permission import PermissionService


class PermissionViewSet(
    OrganizationContextMixin,
    IdOrCodeDetailMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    API endpoint for Permission.
    """

    queryset = Permission.objects.all()

    selector_class = PermissionSelector
    service_class = PermissionService

    filterset_class = PermissionFilterSet

    pagination_class = StandardPagination

    serializer_map = {
        "list": PermissionListSerializer,
        "retrieve": PermissionDetailSerializer,
        "create": PermissionCreateSerializer,
        "update": PermissionUpdateSerializer,
        "partial_update": PermissionUpdateSerializer,
    }

    permission_map = {
        "list": (PermissionPermissions.VIEW,),
        "retrieve": (PermissionPermissions.VIEW,),
        "create": (PermissionPermissions.CREATE,),
        "update": (PermissionPermissions.UPDATE,),
        "partial_update": (PermissionPermissions.UPDATE,),
        "destroy": (PermissionPermissions.DELETE,),
    }