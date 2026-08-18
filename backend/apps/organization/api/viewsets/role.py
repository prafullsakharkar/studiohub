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
    }
