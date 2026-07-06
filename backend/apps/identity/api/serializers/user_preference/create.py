from apps.identity.services.user_preference import (
    UserPreferenceService,
)

from .base import UserPreferenceBaseSerializer


class UserPreferenceCreateSerializer(
    UserPreferenceBaseSerializer,
):

    def create(
        self,
        validated_data,
    ):
        return UserPreferenceService.create(
            **validated_data,
        )
