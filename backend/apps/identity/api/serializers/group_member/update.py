from apps.identity.services.group_member import (
    GroupMemberService,
)

from .base import GroupMemberBaseSerializer


class GroupMemberUpdateSerializer(
    GroupMemberBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return GroupMemberService.update(
            instance,
            **validated_data,
        )
