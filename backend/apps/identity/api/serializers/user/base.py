from apps.identity.models import User

from ..base import IdentitySerializer


class UserBaseSerializer(
    IdentitySerializer,
):

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = User

        fields = (
            "id",
            "uuid",
            "email",
            "is_active",
            "is_staff",
            "is_email_verified",
            "last_seen",
            "display_name",
            "full_name",
            "metadata",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "is_email_verified",
            "last_seen",
            "display_name",
            "full_name",
            "created_at",
            "updated_at",
        )
