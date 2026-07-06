from .base import LoginHistoryBaseSerializer


class LoginHistoryListSerializer(
    LoginHistoryBaseSerializer,
):

    class Meta(
        LoginHistoryBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "user",
            "event",
            "success",
            "ip_address",
            "device",
            "created_at",
        )
