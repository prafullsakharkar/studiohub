from apps.identity.api.serializers.base import IdentitySerializer
from apps.identity.models import IPBlacklist


class IPBlacklistBaseSerializer(
    IdentitySerializer,
):

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = IPBlacklist

        fields = (
            "id",
            "uuid",
            "ip_address",
            "network",
            "description",
            "reason",
            "blocked_by",
            "is_active",
            "expires_at",
            "last_hit_at",
            "hit_count",
            "metadata",
            "expired",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "last_hit_at",
            "hit_count",
            "expired",
            "created_at",
            "updated_at",
        )


# Backwards-compatible alias (the public API exposes this name).
IPBlacklistSerializer = IPBlacklistBaseSerializer
