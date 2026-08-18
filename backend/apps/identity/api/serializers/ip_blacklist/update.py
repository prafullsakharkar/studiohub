from apps.identity.services.ip_blacklist import (
    IPBlacklistService,
)
from apps.identity.validators.ip_blacklist import (
    IPBlacklistValidator,
)

from .base import IPBlacklistBaseSerializer


class IPBlacklistUpdateSerializer(
    IPBlacklistBaseSerializer,
):

    def update(self, instance, validated_data):
        IPBlacklistValidator.validate_update(instance, **validated_data)

        ip_blacklist = IPBlacklistService.update(
            instance,
            **validated_data,
        )

        return ip_blacklist
