from .base import LoginHistoryBaseSerializer


class LoginHistorySummarySerializer(
    LoginHistoryBaseSerializer,
):

    class Meta(
        LoginHistoryBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "event",
            "success",
            "created_at",
        )
