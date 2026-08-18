from rest_framework import serializers

from apps.identity.api.serializers.base import (
    IdentitySerializer,
)
from apps.identity.models import (
    Profile,
    SecurityEvent,
    TrustedDevice,
)


class ProfileBaseSerializer(
    IdentitySerializer,
):

    display_name = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = Profile

        fields = (
            "id",
            "uuid",
            "user",
            "first_name",
            "last_name",
            "display_name",
            "avatar",
            "phone",
            "bio",
            "timezone",
            "language",
            "preferences",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "user",
            "created_at",
            "updated_at",
        )


class SecurityEventBaseSerializer(
    IdentitySerializer,
):

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = SecurityEvent

        fields = (
            "id",
            "uuid",
            "user",
            "event_type",
            "ip_address",
            "user_agent",
            "description",
            "metadata",
            "is_critical",
            "occurred_at",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "user",
            "occurred_at",
            "created_at",
            "updated_at",
        )


class TrustedDeviceBaseSerializer(
    IdentitySerializer,
):

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = TrustedDevice

        fields = (
            "id",
            "uuid",
            "user",
            "fingerprint",
            "browser",
            "platform",
            "ip_address",
            "user_agent",
            "last_login_at",
            "expires_at",
            "is_trusted",
            "revoked_at",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "user",
            "created_at",
            "updated_at",
        )


# Backwards-compatible aliases (the public API exposes these names).
ProfileSerializer = ProfileBaseSerializer
SecurityEventSerializer = SecurityEventBaseSerializer
TrustedDeviceSerializer = TrustedDeviceBaseSerializer
