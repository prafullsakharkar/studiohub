from apps.identity.services.login_history import (
    LoginHistoryService,
)

from .base import LoginHistoryBaseSerializer


class LoginHistoryCreateSerializer(
    LoginHistoryBaseSerializer,
):

    def create(
        self,
        validated_data,
    ):
        return LoginHistoryService.create(
            **validated_data,
        )
