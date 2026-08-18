from .base import LoginAttemptBaseSerializer


class LoginAttemptListSerializer(
    LoginAttemptBaseSerializer,
):

    class Meta(
        LoginAttemptBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "user",
            "username",
            "ip_address",
            "success",
            "reason",
            "attempted_at",
        )

        read_only_fields = LoginAttemptBaseSerializer.Meta.read_only_fields
