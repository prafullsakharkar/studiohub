from apps.identity.services.user_session import (
    UserSessionService,
)

from .base import UserSessionBaseSerializer


class UserSessionCreateSerializer(
    UserSessionBaseSerializer,
):

    def create(
        self,
        validated_data,
    ):
        return UserSessionService.create(
            **validated_data,
        )
