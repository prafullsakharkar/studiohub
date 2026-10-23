"""
RBAC viewsets (org-removal B3).

Identity-owned flat CRUD + management actions for the platform-global
authorization resources: roles, groups, permissions. Reads are open to every
authenticated user (shared reference data); writes require the matching
``identity.<resource>.<action>`` grant and route through ``RoleService`` /
``GroupService`` (SVC-RBAC-01) so escalation and system-row guards always run.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform import PlatformScopedViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.api.serializers.rbac import (
    AddMemberSerializer,
    AssignUserSerializer,
    AttachGroupSerializer,
    AttachRoleSerializer,
    GrantPermissionSerializer,
    GroupMemberListSerializer,
    GroupRoleListSerializer,
    GroupSerializer,
    PermissionSerializer,
    RevokePermissionSerializer,
    RoleGroupListSerializer,
    RolePermissionListSerializer,
    RoleSerializer,
    RoleUserListSerializer,
)
from apps.identity.constants.permissions import (
    GroupPermissions,
    PermissionPermissions,
    RolePermissions,
)
from apps.identity.models import (
    GroupMember,
    GroupRole,
    RolePermission,
    UserRole,
)
from apps.identity.permissions import HasPermission
from apps.identity.selectors.rbac import (
    GroupSelector,
    PermissionSelector,
    RoleSelector,
)
from apps.identity.services.rbac import (
    GroupService,
    PermissionService,
    RoleService,
)


class IdentityRbacGuard:
    """Open reads, grant-gated writes for global RBAC records."""

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    lookup_field = "id"
    lookup_url_kwarg = "pk"

    if TYPE_CHECKING:
        # Provided by the concrete ViewSet this mixin is combined with.
        request: Request  # pyright: ignore[reportUninitializedInstanceVariable]
        service_class: Any  # pyright: ignore[reportUninitializedInstanceVariable]

        def get_object(self) -> Any: ...

    # Sub-resource actions whose GET is a shared read (like list/retrieve);
    # their POST/DELETE still require the owning resource's UPDATE grant.
    READ_SUB_ACTIONS = ("permissions", "users", "groups", "members", "roles")

    def get_permission_required(self):
        action = getattr(self, "action", None)
        if action in self.READ_SUB_ACTIONS and getattr(self.request, "method", "") == "GET":
            return ()
        return super().get_permission_required()  # pyright: ignore[reportAttributeAccessIssue]

    # CRUD always runs through the owning service (SVC-RBAC-01) so system-row,
    # escalation and audit guards cannot be bypassed by serializer.save().
    def perform_create(self, serializer):
        self.service_class.create(
            user=self.request.user,
            **serializer.validated_data,
        )

    def perform_update(self, serializer):
        self.service_class.update(
            instance=self.get_object(),
            user=self.request.user,
            **serializer.validated_data,
        )

    def perform_destroy(self, instance):
        self.service_class.delete(
            instance=instance,
            user=self.request.user,
        )


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
    service_class = RoleService
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
        "permissions": (RolePermissions.UPDATE,),
        "users": (RolePermissions.UPDATE,),
        "groups": (RolePermissions.UPDATE,),
    }

    # ------------------------------------------------------------------
    # Management actions
    # ------------------------------------------------------------------

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        url_path="permissions",
    )
    def permissions(self, request, pk=None):
        role = self.get_object()

        if request.method == "GET":
            queryset = RolePermission.objects.filter(
                role=role,
                is_deleted=False,
            ).select_related("permission", "granted_by")
            serializer = RolePermissionListSerializer(
                queryset,
                many=True,
                context=self.get_serializer_context(),
            )
            return Response(serializer.data)

        if request.method == "POST":
            serializer = GrantPermissionSerializer(
                data=request.data,
                context=self.get_serializer_context(),
            )
            serializer.is_valid(raise_exception=True)
            self.service_class.grant_permission(
                role=role,
                permission=serializer.validated_data["permission"],
                actor=request.user,
                expires_at=serializer.validated_data.get("expires_at"),
            )
            return Response(
                {"detail": "Permission granted."},
                status=201,
            )

        serializer = RevokePermissionSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        self.service_class.revoke_permission(
            role=role,
            permission=serializer.validated_data["permission"],
            actor=request.user,
        )
        return Response({"detail": "Permission revoked."})

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        url_path="users",
    )
    def users(self, request, pk=None):
        role = self.get_object()

        if request.method == "GET":
            queryset = UserRole.objects.filter(
                role=role,
                is_deleted=False,
            ).select_related("user")
            serializer = RoleUserListSerializer(
                queryset,
                many=True,
                context=self.get_serializer_context(),
            )
            return Response(serializer.data)

        if request.method == "POST":
            serializer = AssignUserSerializer(
                data=request.data,
                context=self.get_serializer_context(),
            )
            serializer.is_valid(raise_exception=True)
            self.service_class.assign_user(
                role=role,
                user=serializer.validated_data["user"],
                actor=request.user,
            )
            return Response(
                {"detail": "Role assigned."},
                status=201,
            )

        serializer = AssignUserSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        self.service_class.unassign_user(
            role=role,
            user=serializer.validated_data["user"],
            actor=request.user,
        )
        return Response({"detail": "Role unassigned."})

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        url_path="groups",
    )
    def groups(self, request, pk=None):
        role = self.get_object()

        if request.method == "GET":
            queryset = GroupRole.objects.filter(
                role=role,
                is_deleted=False,
            ).select_related("group")
            serializer = RoleGroupListSerializer(
                queryset,
                many=True,
                context=self.get_serializer_context(),
            )
            return Response(serializer.data)

        if request.method == "POST":
            serializer = AttachGroupSerializer(
                data=request.data,
                context=self.get_serializer_context(),
            )
            serializer.is_valid(raise_exception=True)
            self.service_class.attach_group(
                role=role,
                group=serializer.validated_data["group"],
                actor=request.user,
            )
            return Response(
                {"detail": "Group attached."},
                status=201,
            )

        serializer = AttachGroupSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        self.service_class.detach_group(
            role=role,
            group=serializer.validated_data["group"],
            actor=request.user,
        )
        return Response({"detail": "Group detached."})


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
    service_class = GroupService
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
        "members": (GroupPermissions.UPDATE,),
        "roles": (GroupPermissions.UPDATE,),
    }

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        url_path="members",
    )
    def members(self, request, pk=None):
        group = self.get_object()

        if request.method == "GET":
            queryset = GroupMember.objects.filter(
                group=group,
                is_deleted=False,
                left_at__isnull=True,
            ).select_related("user")
            serializer = GroupMemberListSerializer(
                queryset,
                many=True,
                context=self.get_serializer_context(),
            )
            return Response(serializer.data)

        if request.method == "POST":
            serializer = AddMemberSerializer(
                data=request.data,
                context=self.get_serializer_context(),
            )
            serializer.is_valid(raise_exception=True)
            self.service_class.add_member(
                group=group,
                user=serializer.validated_data["user"],
                actor=request.user,
                is_owner=serializer.validated_data.get("is_owner", False),
                is_manager=serializer.validated_data.get("is_manager", False),
            )
            return Response(
                {"detail": "Member added."},
                status=201,
            )

        serializer = AddMemberSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        self.service_class.remove_member(
            group=group,
            user=serializer.validated_data["user"],
            actor=request.user,
        )
        return Response({"detail": "Member removed."})

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        url_path="roles",
    )
    def roles(self, request, pk=None):
        group = self.get_object()

        if request.method == "GET":
            queryset = GroupRole.objects.filter(
                group=group,
                is_deleted=False,
            ).select_related("role")
            serializer = GroupRoleListSerializer(
                queryset,
                many=True,
                context=self.get_serializer_context(),
            )
            return Response(serializer.data)

        if request.method == "POST":
            serializer = AttachRoleSerializer(
                data=request.data,
                context=self.get_serializer_context(),
            )
            serializer.is_valid(raise_exception=True)
            self.service_class.grant_role(
                group=group,
                role=serializer.validated_data["role"],
                actor=request.user,
            )
            return Response(
                {"detail": "Role granted."},
                status=201,
            )

        serializer = AttachRoleSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        self.service_class.revoke_role(
            group=group,
            role=serializer.validated_data["role"],
            actor=request.user,
        )
        return Response({"detail": "Role revoked."})


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
    service_class = PermissionService
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
