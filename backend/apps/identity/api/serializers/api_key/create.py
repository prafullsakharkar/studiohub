from rest_framework import serializers

from .base import APIKeyBaseSerializer


class APIKeyCreateSerializer(
    APIKeyBaseSerializer,
):
    token = serializers.CharField(
        read_only=True,
    )

    class Meta(APIKeyBaseSerializer.Meta):
        read_only_fields = (
            *APIKeyBaseSerializer.Meta.read_only_fields,
            "token",
        )
