from apps.identity.services.group_member import (
    GroupMemberService,
)

from .base import GroupMemberBaseSerializer


class GroupMemberCreateSerializer(
    GroupMemberBaseSerializer,
):

    def create(
        self,
        validated_data,
    ):
        return GroupMemberService.create(
            **validated_data,
        )
