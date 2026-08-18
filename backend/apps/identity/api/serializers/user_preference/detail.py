from .base import (
    ProfileBaseSerializer,
    SecurityEventBaseSerializer,
    TrustedDeviceBaseSerializer,
)


class ProfileDetailSerializer(
    ProfileBaseSerializer,
):

    class Meta(
        ProfileBaseSerializer.Meta,
    ):
        pass


class SecurityEventDetailSerializer(
    SecurityEventBaseSerializer,
):

    class Meta(
        SecurityEventBaseSerializer.Meta,
    ):
        pass


class TrustedDeviceDetailSerializer(
    TrustedDeviceBaseSerializer,
):

    class Meta(
        TrustedDeviceBaseSerializer.Meta,
    ):
        pass
