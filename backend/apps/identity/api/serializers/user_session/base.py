from apps.identity.api.serializers.base import (
    IdentitySerializer,
)
from apps.identity.models import (
    UserSession,
)


class UserSessionBaseSerializer(
    IdentitySerializer,
):

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = UserSession

        fields = (
            "id",
            "uuid",
            "user",
            "session_key",
            "device",
            "browser",
            "operating_system",
            "ip_address",
            "location",
            "login_at",
            "last_activity",
            "expires_at",
            "revoked_at",
            "is_active",
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
