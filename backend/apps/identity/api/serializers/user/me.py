from .base import UserBaseSerializer


class UserMeSerializer(
    UserBaseSerializer,
):
    class Meta(
        UserBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "email",
            "display_name",
            "full_name",
            "is_email_verified",
            "last_seen",
            "metadata",
            "created_at",
            "updated_at",
        )
