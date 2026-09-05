from apps.organization.api.filtersets.user_role import UserRoleFilterSet
from apps.organization.api.serializers.user_role import (
    UserRoleAssignSerializer,
    UserRoleDetailSerializer,
    UserRoleListSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import UserRolePermissions
from apps.organization.models.user_role import UserRole
from apps.organization.selectors.user_role import UserRoleSelector
from apps.organization.services.user_role import UserRoleService


class UserRoleViewSet(OrganizationEntityViewSet):
    """
    API endpoint for UserRole.
    """

    queryset = UserRole.objects.all()

    selector_class = UserRoleSelector
    service_class = UserRoleService

    search_fields = ()

    ordering = ("-created_at",)

    ordering_fields = (
        "created_at",
        "updated_at",
    )

    filterset_class = UserRoleFilterSet

    serializer_map = {
        "list": UserRoleListSerializer,
        "retrieve": UserRoleDetailSerializer,
        "assign": UserRoleAssignSerializer,
        "revoke": UserRoleAssignSerializer,
    }

    permission_map = {
        "list": (UserRolePermissions.ASSIGN,),
        "retrieve": (UserRolePermissions.ASSIGN,),
        "assign": (UserRolePermissions.ASSIGN,),
        "revoke": (UserRolePermissions.REVOKE,),
        "update": (UserRolePermissions.ASSIGN,),
        "partial_update": (UserRolePermissions.ASSIGN,),
        "destroy": (UserRolePermissions.REVOKE,),
    }

    def get_serializer_class(self):
        if self.action == "assign":
            return self.serializer_map["assign"]
        if self.action == "revoke":
            return self.serializer_map["revoke"]
        return super().get_serializer_class()
