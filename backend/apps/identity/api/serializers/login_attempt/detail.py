from .base import LoginAttemptBaseSerializer


class LoginAttemptDetailSerializer(
    LoginAttemptBaseSerializer,
):

    class Meta(
        LoginAttemptBaseSerializer.Meta,
    ):
        pass
