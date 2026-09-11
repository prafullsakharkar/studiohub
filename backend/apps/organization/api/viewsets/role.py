from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.role import RoleFilterSet
from apps.organization.api.serializers.role import (
    RoleCreateSerializer,
    RoleDetailSerializer,
    RoleListSerializer,
    RoleUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.api.viewsets.compat import IdOrCodeDetailMixin
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import RolePermissions
from apps.organization.models.role import Role
from apps.organization.selectors.role import RoleSelector
from apps.organization.services.role import RoleService


class RoleViewSet(
    OrganizationContextMixin,
    IdOrCodeDetailMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
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

    pagination_class = StandardPagination

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
        "assign_user": (RolePermissions.GRANT_PERMISSION,),
        "unassign_user": (RolePermissions.REVOKE_PERMISSION,),
        "assign_group": (RolePermissions.GRANT_PERMISSION,),
        "unassign_group": (RolePermissions.REVOKE_PERMISSION,),
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

    # --- User role assignments ---
    @action(detail=True, methods=["post"], url_path="users/add")
    def assign_user(self, request, *args, **kwargs):
        """Assign this role to a user."""
        role = self.get_object()
        user_id = request.data.get("user_id")
        if not user_id:
            raise ValidationError({"user_id": "Required."})
        user_role, error = self.service_class.assign_user(role, user_id, user=request.user)
        if error:
            return Response({"detail": error}, status=status.HTTP_404_NOT_FOUND)
        return Response({"id": str(role.id), "user_role_id": str(user_role.id)})

    @action(detail=True, methods=["post"], url_path="users/remove")
    def unassign_user(self, request, *args, **kwargs):
        """Remove this role from a user."""
        role = self.get_object()
        user_id = request.data.get("user_id")
        if not user_id:
            raise ValidationError({"user_id": "Required."})
        success, error = self.service_class.unassign_user(role, user_id, user=request.user)
        return Response({"id": str(role.id), "removed": success})

    @action(detail=True, methods=["get"], url_path="users")
    def list_users(self, request, *args, **kwargs):
        """List users assigned this role."""
        role = self.get_object()
        from apps.organization.api.serializers.user_role import UserRoleListSerializer
        from apps.organization.models import UserRole

        qs = UserRole.objects.filter(role=role).select_related("user")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = UserRoleListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = UserRoleListSerializer(qs, many=True)
        return Response(serializer.data)

    # --- Group role assignments ---
    @action(detail=True, methods=["post"], url_path="groups/add")
    def assign_group(self, request, *args, **kwargs):
        """Assign this role to a group."""
        role = self.get_object()
        group_id = request.data.get("group_id")
        if not group_id:
            raise ValidationError({"group_id": "Required."})
        group_role, error = self.service_class.assign_group(role, group_id, user=request.user)
        if error:
            return Response({"detail": error}, status=status.HTTP_404_NOT_FOUND)
        return Response({"id": str(role.id), "group_role_id": str(group_role.id)})

    @action(detail=True, methods=["post"], url_path="groups/remove")
    def unassign_group(self, request, *args, **kwargs):
        """Remove this role from a group."""
        role = self.get_object()
        group_id = request.data.get("group_id")
        if not group_id:
            raise ValidationError({"group_id": "Required."})
        success, error = self.service_class.unassign_group(role, group_id, user=request.user)
        return Response({"id": str(role.id), "removed": success})

    @action(detail=True, methods=["get"], url_path="groups")
    def list_groups(self, request, *args, **kwargs):
        """List groups assigned this role."""
        role = self.get_object()
        from apps.organization.api.serializers.group_role import GroupRoleListSerializer
        from apps.organization.models import GroupRole

        qs = GroupRole.objects.filter(role=role).select_related("group")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = GroupRoleListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = GroupRoleListSerializer(qs, many=True)
        return Response(serializer.data)