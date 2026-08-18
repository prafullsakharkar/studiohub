from apps.identity.services.login_attempt import (
    LoginAttemptService,
)

from .base import LoginAttemptBaseSerializer


class LoginAttemptUpdateSerializer(
    LoginAttemptBaseSerializer,
):

    class Meta(
        LoginAttemptBaseSerializer.Meta,
    ):
        pass

    def update(
        self,
        instance,
        validated_data,
    ):
        return LoginAttemptService.update(
            instance,
            **validated_data,
        )
