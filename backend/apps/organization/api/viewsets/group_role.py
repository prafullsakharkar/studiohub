from apps.organization.api.filtersets.group_role import GroupRoleFilterSet
from apps.organization.api.serializers.group_role import (
    GroupRoleAddSerializer,
    GroupRoleCreateSerializer,
    GroupRoleDetailSerializer,
    GroupRoleListSerializer,
    GroupRoleRemoveSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import GroupRolePermissions
from apps.organization.models.group_role import GroupRole
from apps.organization.selectors.group_role import GroupRoleSelector
from apps.organization.services.group_role import GroupRoleService


class GroupRoleViewSet(OrganizationEntityViewSet):
    """
    API endpoint for GroupRole.
    """

    queryset = GroupRole.objects.all()

    selector_class = GroupRoleSelector
    service_class = GroupRoleService

    search_fields = ()

    ordering = ("-created_at",)

    ordering_fields = (
        "created_at",
        "updated_at",
    )

    filterset_class = GroupRoleFilterSet

    serializer_map = {
        "list": GroupRoleListSerializer,
        "retrieve": GroupRoleDetailSerializer,
        "create": GroupRoleCreateSerializer,
        "add": GroupRoleAddSerializer,
        "remove": GroupRoleRemoveSerializer,
    }

    permission_map = {
        "list": (GroupRolePermissions.ADD,),
        "retrieve": (GroupRolePermissions.ADD,),
        "create": (GroupRolePermissions.ADD,),
        "add": (GroupRolePermissions.ADD,),
        "remove": (GroupRolePermissions.REMOVE,),
    }

    def get_serializer_class(self):
        if self.action == "add":
            return self.serializer_map["add"]
        if self.action == "remove":
            return self.serializer_map["remove"]
        return super().get_serializer_class()
