from apps.identity.api.serializers.base import (
    IdentitySerializer,
)
from apps.identity.models import (
    LoginAttempt,
)


class LoginAttemptBaseSerializer(
    IdentitySerializer,
):

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = LoginAttempt

        fields = (
            "id",
            "uuid",
            "user",
            "username",
            "ip_address",
            "user_agent",
            "success",
            "reason",
            "attempted_at",
            "locked_until",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "attempted_at",
            "created_at",
            "updated_at",
        )


# Backwards-compatible alias (the public API exposes this name).
LoginAttemptSerializer = LoginAttemptBaseSerializer
