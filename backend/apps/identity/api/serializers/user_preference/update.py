from apps.identity.services.user_preference import (
    UserPreferenceService,
)

from .base import UserPreferenceBaseSerializer


class UserPreferenceUpdateSerializer(
    UserPreferenceBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return UserPreferenceService.update(
            instance,
            **validated_data,
        )
