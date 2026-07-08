from apps.identity.api.serializers.base import (
    IdentityModelSerializer,
)
from apps.identity.models import APIKey


class APIKeyBaseSerializer(
    IdentityModelSerializer,
):
    class Meta:
        model = APIKey

        fields = (
            "uuid",
            "name",
            "description",
            "organization",
            "created_by",
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
