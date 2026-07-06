from apps.identity.services.login_history import (
    LoginHistoryService,
)

from .base import LoginHistoryBaseSerializer


class LoginHistoryUpdateSerializer(
    LoginHistoryBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return LoginHistoryService.update(
            instance,
            **validated_data,
        )
