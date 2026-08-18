from .base import (
    ProfileBaseSerializer,
    SecurityEventBaseSerializer,
    TrustedDeviceBaseSerializer,
)


class ProfileListSerializer(
    ProfileBaseSerializer,
):

    class Meta(
        ProfileBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "user",
            "first_name",
            "last_name",
            "display_name",
            "avatar",
            "timezone",
            "language",
        )

        read_only_fields = ProfileBaseSerializer.Meta.read_only_fields


class SecurityEventListSerializer(
    SecurityEventBaseSerializer,
):

    class Meta(
        SecurityEventBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "user",
            "event_type",
            "ip_address",
            "occurred_at",
        )

        read_only_fields = SecurityEventBaseSerializer.Meta.read_only_fields


class TrustedDeviceListSerializer(
    TrustedDeviceBaseSerializer,
):

    class Meta(
        TrustedDeviceBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "user",
            "fingerprint",
            "browser",
            "platform",
            "ip_address",
            "is_trusted",
            "last_login_at",
        )

        read_only_fields = TrustedDeviceBaseSerializer.Meta.read_only_fields
