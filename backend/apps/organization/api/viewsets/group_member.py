from apps.organization.api.filtersets.group_member import GroupMemberFilterSet
from apps.organization.api.serializers.group_member import (
    GroupMemberAddSerializer,
    GroupMemberCreateSerializer,
    GroupMemberDetailSerializer,
    GroupMemberListSerializer,
    GroupMemberRemoveSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import GroupMemberPermissions
from apps.organization.models.group_member import GroupMember
from apps.organization.selectors.group_member import GroupMemberSelector
from apps.organization.services.group_member import GroupMemberService


class GroupMemberViewSet(OrganizationEntityViewSet):
    """
    API endpoint for GroupMember.
    """

    queryset = GroupMember.objects.all()

    selector_class = GroupMemberSelector
    service_class = GroupMemberService

    search_fields = ()

    ordering = ("-created_at",)

    ordering_fields = (
        "created_at",
        "updated_at",
    )

    filterset_class = GroupMemberFilterSet

    serializer_map = {
        "list": GroupMemberListSerializer,
        "retrieve": GroupMemberDetailSerializer,
        "create": GroupMemberCreateSerializer,
        "add": GroupMemberAddSerializer,
        "remove": GroupMemberRemoveSerializer,
    }

    permission_map = {
        "list": (GroupMemberPermissions.ADD,),
        "retrieve": (GroupMemberPermissions.ADD,),
        "create": (GroupMemberPermissions.ADD,),
        "add": (GroupMemberPermissions.ADD,),
        "remove": (GroupMemberPermissions.REMOVE,),
    }

    def get_serializer_class(self):
        if self.action == "add":
            return self.serializer_map["add"]
        if self.action == "remove":
            return self.serializer_map["remove"]
        return super().get_serializer_class()
