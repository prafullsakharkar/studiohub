from apps.identity.services.profile import ProfileService
from apps.identity.services.security_event import SecurityEventService
from apps.identity.services.trusted_device import TrustedDeviceService

from .base import (
    ProfileBaseSerializer,
    SecurityEventBaseSerializer,
    TrustedDeviceBaseSerializer,
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


class SecurityEventUpdateSerializer(
    SecurityEventBaseSerializer,
):

    class Meta(
        SecurityEventBaseSerializer.Meta,
    ):
        pass

    def update(
        self,
        instance,
        validated_data,
    ):
        return SecurityEventService.update(
            instance,
            **validated_data,
        )


class TrustedDeviceUpdateSerializer(
    TrustedDeviceBaseSerializer,
):

    class Meta(
        TrustedDeviceBaseSerializer.Meta,
    ):
        pass

    def update(
        self,
        instance,
        validated_data,
    ):
        return TrustedDeviceService.update(
            instance,
            **validated_data,
        )
