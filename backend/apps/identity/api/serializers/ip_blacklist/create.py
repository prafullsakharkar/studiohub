from rest_framework import serializers

from apps.identity.services.ip_blacklist import (
    IPBlacklistService,
)
from apps.identity.validators.ip_blacklist import (
    IPBlacklistValidator,
)

from .base import IPBlacklistBaseSerializer


class IPBlacklistCreateSerializer(
    IPBlacklistBaseSerializer,
):

    class Meta(
        IPBlacklistBaseSerializer.Meta,
    ):
        fields = IPBlacklistBaseSerializer.Meta.fields + (
            "blocked_by",
        )
        read_only_fields = IPBlacklistBaseSerializer.Meta.read_only_fields

    def create(self, validated_data):
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            validated_data["blocked_by"] = request.user

        IPBlacklistValidator.validate_create(**validated_data)

        ip_blacklist = IPBlacklistService.create(**validated_data)

        return ip_blacklist
