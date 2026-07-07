from rest_framework import serializers

from apps.identity.models import UserSession


class UserSessionBaseSerializer(
    serializers.ModelSerializer,
):

    class Meta:
        model = UserSession

        fields = (
            "uuid",
            "user",
            "organization",
            "office",
            "department",
            "team",
            "session_key",
            "authentication_method",
            "device_name",
            "device_type",
            "browser",
            "browser_version",
            "operating_system",
            "os_version",
            "user_agent",
            "ip_address",
            "country",
            "region",
            "city",
            "timezone",
            "status",
            "is_current",
            "is_trusted",
            "expires_at",
            "ended_at",
            "metadata",
        )

        read_only_fields = ("uuid",)
