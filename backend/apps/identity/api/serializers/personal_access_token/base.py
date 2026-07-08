from apps.identity.api.serializers.base import (
    IdentityModelSerializer,
)
from apps.identity.models import (
    PersonalAccessToken,
)


class PersonalAccessTokenBaseSerializer(
    IdentityModelSerializer,
):
    class Meta:
        model = PersonalAccessToken

        fields = (
            "uuid",
            "user",
            "name",
            "prefix",
            "scopes",
            "expires_at",
            "last_used_at",
            "last_used_ip",
            "is_active",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "uuid",
            "prefix",
            "last_used_at",
            "last_used_ip",
            "created_at",
            "updated_at",
        )
