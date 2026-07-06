from apps.identity.api.serializers.base import (
    IdentitySerializer,
)
from apps.identity.models import (
    GroupMember,
)


class GroupMemberBaseSerializer(
    IdentitySerializer,
):

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = GroupMember

        fields = (
            "id",
            "uuid",
            "group",
            "user",
            "status",
            "is_owner",
            "is_manager",
            "joined_at",
            "left_at",
            "metadata",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "joined_at",
            "created_at",
            "updated_at",
        )
