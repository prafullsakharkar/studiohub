from .base import UserSessionBaseSerializer


class UserSessionListSerializer(
    UserSessionBaseSerializer,
):

    class Meta(
        UserSessionBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "device",
            "browser",
            "operating_system",
            "ip_address",
            "login_at",
            "last_activity",
            "expires_at",
            "is_active",
        )
