from apps.identity.api.serializers.base import (
    IdentitySerializer,
)
from apps.identity.models import (
    LoginHistory,
)


class LoginHistoryBaseSerializer(
    IdentitySerializer,
):

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = LoginHistory

        fields = (
            "id",
            "uuid",
            "user",
            "session",
            "event",
            "success",
            "ip_address",
            "user_agent",
            "browser",
            "operating_system",
            "device",
            "location",
            "metadata",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
