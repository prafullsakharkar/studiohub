from typing import Any

from rest_framework import serializers


class TrustedDeviceSerializer(serializers.Serializer[Any]):
    remember = serializers.BooleanField(
        default=True,
    )


class TrustedDeviceRevokeSerializer(serializers.Serializer[Any]):
    device_id = serializers.UUIDField()
