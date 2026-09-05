from rest_framework import serializers

from apps.identity.api.serializers.base import (
    IdentitySerializer,
)
from apps.organization.models import (
    UserSession,
)


class UserSessionBaseSerializer(
    IdentitySerializer,
):
    """
    Serializer matching the frontend ``Session`` contract.
    """

    location = serializers.SerializerMethodField()

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = UserSession

        fields = (
            "id",
            "user_id",
            "user_agent",
            "ip_address",
            "location",
            "is_current",
            "created_at",
            "last_activity",
            "expires_at",
        )

        read_only_fields = fields

    def get_location(
        self,
        instance,
    ):
        parts = [
            part
            for part in (
                instance.city,
                instance.region,
                instance.country,
            )
            if part
        ]

        return ", ".join(parts) if parts else None
