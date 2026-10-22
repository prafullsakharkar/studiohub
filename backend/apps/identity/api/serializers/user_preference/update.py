
from apps.identity.services.profile import ProfileService

from .base import (
    ProfileBaseSerializer,
)


class ProfileUpdateSerializer(
    ProfileBaseSerializer,
):

    class Meta(
        ProfileBaseSerializer.Meta,
    ):
        pass

    def update(
        self,
        instance,
        validated_data,
    ):
        return ProfileService.update_profile(
            instance,
            **validated_data,
        )
