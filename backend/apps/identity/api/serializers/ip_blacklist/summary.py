from .base import IPBlacklistBaseSerializer


class IPBlacklistSummarySerializer(
    IPBlacklistBaseSerializer,
):

    class Meta(
        IPBlacklistBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "ip_address",
            "network",
            "description",
            "reason",
            "is_active",
            "expired",
            "created_at",
        )
