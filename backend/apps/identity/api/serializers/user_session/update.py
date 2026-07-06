from apps.identity.services.user_session import (
    UserSessionService,
)

from .base import UserSessionBaseSerializer


class UserSessionUpdateSerializer(
    UserSessionBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return UserSessionService.update(
            instance,
            **validated_data,
        )
