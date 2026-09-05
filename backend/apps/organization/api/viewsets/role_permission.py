from apps.organization.api.filtersets.role_permission import RolePermissionFilterSet
from apps.organization.api.serializers.role_permission import (
    RolePermissionCreateSerializer,
    RolePermissionDetailSerializer,
    RolePermissionGrantSerializer,
    RolePermissionListSerializer,
    RolePermissionRevokeSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import RolePermissionPermissions
from apps.organization.models.role_permission import RolePermission
from apps.organization.selectors.role_permission import RolePermissionSelector
from apps.organization.services.role_permission import RolePermissionService


class RolePermissionViewSet(OrganizationEntityViewSet):
    """
    API endpoint for RolePermission.
    """

    queryset = RolePermission.objects.all()

    selector_class = RolePermissionSelector
    service_class = RolePermissionService

    search_fields = ()

    ordering = ("-created_at",)

    ordering_fields = (
        "created_at",
        "updated_at",
    )

    filterset_class = RolePermissionFilterSet

    serializer_map = {
        "list": RolePermissionListSerializer,
        "retrieve": RolePermissionDetailSerializer,
        "create": RolePermissionCreateSerializer,
        "grant": RolePermissionGrantSerializer,
        "revoke": RolePermissionRevokeSerializer,
    }

    permission_map = {
        "list": (RolePermissionPermissions.GRANT,),
        "retrieve": (RolePermissionPermissions.GRANT,),
        "create": (RolePermissionPermissions.GRANT,),
        "grant": (RolePermissionPermissions.GRANT,),
        "revoke": (RolePermissionPermissions.REVOKE,),
        "update": (RolePermissionPermissions.GRANT,),
        "partial_update": (RolePermissionPermissions.GRANT,),
        "destroy": (RolePermissionPermissions.REVOKE,),
    }

    def get_serializer_class(self):
        if self.action == "grant":
            return self.serializer_map["grant"]
        if self.action == "revoke":
            return self.serializer_map["revoke"]
        return super().get_serializer_class()
