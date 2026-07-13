from apps.identity.services.user import (
    UserService,
)

from .base import UserBaseSerializer


class UserUpdateSerializer(
    UserBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return UserService.update(
            instance,
            **validated_data,
        )
