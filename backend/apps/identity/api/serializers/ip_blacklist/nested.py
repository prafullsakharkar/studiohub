from typing import Any

from apps.core.api.serializers.base import BaseNestedSerializer
from apps.identity.models import IPBlacklist


class IPBlacklistNestedSerializer(BaseNestedSerializer[Any]):

    class Meta(BaseNestedSerializer.Meta):

        model = IPBlacklist

        fields = (
            "id",
            "uuid",
            "ip_address",
            "network",
            "description",
            "reason",
            "is_active",
        )
