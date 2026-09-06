from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.organization.api.filtersets.role import RoleFilterSet
from apps.organization.api.serializers.role import (
    RoleCreateSerializer,
    RoleDetailSerializer,
    RoleListSerializer,
    RoleUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import RolePermissions
from apps.organization.models.role import Role
from apps.organization.selectors.role import RoleSelector
from apps.organization.services.role import RoleService


class RoleViewSet(OrganizationEntityViewSet):
    """
    API endpoint for Role.
    """

    queryset = Role.objects.all()

    selector_class = RoleSelector
    service_class = RoleService

    filterset_class = RoleFilterSet

    serializer_map = {
        "list": RoleListSerializer,
        "retrieve": RoleDetailSerializer,
        "create": RoleCreateSerializer,
        "update": RoleUpdateSerializer,
        "partial_update": RoleUpdateSerializer,
    }

    permission_map = {
        "list": (RolePermissions.VIEW,),
        "retrieve": (RolePermissions.VIEW,),
        "create": (RolePermissions.CREATE,),
        "update": (RolePermissions.UPDATE,),
        "partial_update": (RolePermissions.UPDATE,),
        "destroy": (RolePermissions.DELETE,),
        "clone": (RolePermissions.CREATE,),
        "add_permissions": (RolePermissions.GRANT_PERMISSION,),
        "remove_permissions": (RolePermissions.REVOKE_PERMISSION,),
    }

    @action(detail=True, methods=["post"], url_path="clone")
    def clone(self, request, *args, **kwargs):
        """Clone a role (including granted permissions) under a new name/code."""
        role = self.get_object()
        name = (request.data.get("name") or "").strip()
        code = (request.data.get("code") or "").strip()
        if not name or not code:
            raise ValidationError({"detail": "Both name and code are required."})
        cloned = self.service_class.clone(role, name=name, code=code, user=request.user)
        return Response(
            RoleDetailSerializer(cloned, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def _permission_codes(self):
        codes = self.request.data.get("codes", [])
        if not isinstance(codes, list) or not all(isinstance(c, str) for c in codes):
            raise ValidationError({"codes": "Must be a list of permission code strings."})
        return codes

    @action(detail=True, methods=["post"], url_path="permissions/add")
    def add_permissions(self, request, *args, **kwargs):
        """Grant permissions (by dotted code) to a role."""
        role = self.get_object()
        added, unknown = self.service_class.grant_permissions(
            role, self._permission_codes(), user=request.user
        )
        return Response({"id": str(role.id), "added": added, "unknown": unknown})

    @action(detail=True, methods=["post"], url_path="permissions/remove")
    def remove_permissions(self, request, *args, **kwargs):
        """Remove permissions (by dotted code) from a role."""
        role = self.get_object()
        removed, unknown = self.service_class.revoke_permissions(
            role, self._permission_codes(), user=request.user
        )
        return Response({"id": str(role.id), "removed": removed, "unknown": unknown})
