"""
RBAC viewsets (org-removal B3).

Identity-owned flat CRUD for the platform-global authorization
resources: roles, groups, permissions. Reads are open to every
authenticated user (shared reference data); writes require the
matching ``identity.<resource>.<action>`` grant. Paginated like every
other endpoint (global ``StandardPagination`` default).
"""

from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform import PlatformScopedViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.api.serializers.rbac import (
    GroupSerializer,
    PermissionSerializer,
    RoleSerializer,
)
from apps.identity.constants.permissions import (
    GroupPermissions,
    PermissionPermissions,
    RolePermissions,
)
from apps.identity.permissions import HasPermission
from apps.identity.selectors.rbac import (
    GroupSelector,
    PermissionSelector,
    RoleSelector,
)


class IdentityRbacGuard:
    """Open reads, grant-gated writes for global RBAC records."""

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    lookup_field = "id"
    lookup_url_kwarg = "pk"


class RoleViewSet(
    IdentityRbacGuard,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    PlatformScopedViewSet,
):
    serializer_class = RoleSerializer
    selector_class = RoleSelector
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["role_type", "scope", "is_system", "is_default", "is_active"]
    search_fields = ["name", "code"]
    ordering_fields = ["priority", "sort_order", "name", "created_at"]
    ordering = ["priority", "sort_order", "name"]

    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (RolePermissions.CREATE,),
        "update": (RolePermissions.UPDATE,),
        "partial_update": (RolePermissions.UPDATE,),
        "destroy": (RolePermissions.DELETE,),
    }


class GroupViewSet(
    IdentityRbacGuard,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    PlatformScopedViewSet,
):
    serializer_class = GroupSerializer
    selector_class = GroupSelector
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_system"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (GroupPermissions.CREATE,),
        "update": (GroupPermissions.UPDATE,),
        "partial_update": (GroupPermissions.UPDATE,),
        "destroy": (GroupPermissions.DELETE,),
    }


class PermissionViewSet(
    IdentityRbacGuard,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    PlatformScopedViewSet,
):
    serializer_class = PermissionSerializer
    selector_class = PermissionSelector
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["module", "action", "category", "is_system", "is_active"]
    search_fields = ["name", "code"]
    ordering_fields = ["module", "sort_order", "name", "created_at"]
    ordering = ["module", "sort_order", "name"]

    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (PermissionPermissions.CREATE,),
        "update": (PermissionPermissions.UPDATE,),
        "partial_update": (PermissionPermissions.UPDATE,),
        "destroy": (PermissionPermissions.DELETE,),
    }
