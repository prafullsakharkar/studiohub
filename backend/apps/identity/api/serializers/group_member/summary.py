from .base import (
    GroupMemberBaseSerializer,
)


class GroupMemberSummarySerializer(
    GroupMemberBaseSerializer,
):

    class Meta(
        GroupMemberBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "group",
            "user",
            "is_owner",
            "is_manager",
        )
