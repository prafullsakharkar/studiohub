"""
Group API viewset.
"""

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.group import GroupFilterSet
from apps.organization.api.serializers.group import (
    GroupCreateSerializer,
    GroupDetailSerializer,
    GroupListSerializer,
    GroupUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.api.viewsets.compat import IdOrCodeDetailMixin
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import GroupPermissions
from apps.organization.models.group import Group
from apps.organization.selectors.group import GroupSelector
from apps.organization.services.group import GroupService
from apps.organization.api.viewsets.clone_master import CloneMasterMixin
from apps.organization.services.clone_master import normalize_code
from apps.masterdata.models.platform import PlatformGroup
from apps.organization.models import Group


class GroupViewSet(
    CloneMasterMixin,
    OrganizationContextMixin,
    IdOrCodeDetailMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    API endpoint for Group.
    """

    queryset = Group.objects.all()

    selector_class = GroupSelector
    service_class = GroupService

    filterset_class = GroupFilterSet

    pagination_class = StandardPagination

    clone_source_model = PlatformGroup
    clone_target_model = Group
    clone_label = "Master Groups"

    @staticmethod
    def clone_build_kwargs(master):
        return {
            "name": master.name or master.code,
            "code": normalize_code(master.code, master.name),
            "description": master.description or "",
            "is_system": False,
        }

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
        "clone_master": (GroupPermissions.CREATE,),
    }