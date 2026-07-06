from .base import UserSessionBaseSerializer


class UserSessionSummarySerializer(
    UserSessionBaseSerializer,
):

    class Meta(
        UserSessionBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "device",
            "login_at",
            "is_active",
        )
