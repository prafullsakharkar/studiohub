from rest_framework import serializers

from apps.identity.models import UserSession


class UserSessionListSerializer(
    serializers.ModelSerializer,
):

    class Meta:

        model = UserSession

        fields = (
            "uuid",
            "device_name",
            "device_type",
            "browser",
            "operating_system",
            "ip_address",
            "country",
            "city",
            "last_activity_at",
            "expires_at",
            "is_current",
            "is_trusted",
            "is_revoked",
        )
