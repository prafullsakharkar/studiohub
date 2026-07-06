from apps.identity.api.serializers.base import (
    IdentitySerializer,
)
from apps.identity.models import Group


class GroupBaseSerializer(
    IdentitySerializer,
):

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = Group

        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "color",
            "is_system",
            "status",
            "metadata",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
