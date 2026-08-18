from apps.organization.api.filtersets.group import GroupFilterSet
from apps.organization.api.serializers.group import (
    GroupCreateSerializer,
    GroupDetailSerializer,
    GroupListSerializer,
    GroupUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import GroupPermissions
from apps.organization.models.group import Group
from apps.organization.selectors.group import GroupSelector
from apps.organization.services.group import GroupService


class GroupViewSet(OrganizationEntityViewSet):
    """
    API endpoint for Group.
    """

    queryset = Group.objects.all()

    selector_class = GroupSelector
    service_class = GroupService

    filterset_class = GroupFilterSet

    serializer_map = {
        "list": GroupListSerializer,
        "retrieve": GroupDetailSerializer,
        "create": GroupCreateSerializer,
        "update": GroupUpdateSerializer,
        "partial_update": GroupUpdateSerializer,
    }

    permission_map = {
        "list": (GroupPermissions.VIEW,),
        "retrieve": (GroupPermissions.VIEW,),
        "create": (GroupPermissions.CREATE,),
        "update": (GroupPermissions.UPDATE,),
        "partial_update": (GroupPermissions.UPDATE,),
        "destroy": (GroupPermissions.DELETE,),
    }
