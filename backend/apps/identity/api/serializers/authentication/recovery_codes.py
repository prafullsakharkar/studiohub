from typing import Any

from rest_framework import serializers


class RecoveryCodeVerifySerializer(serializers.Serializer[Any]):
    code = serializers.CharField(
        max_length=32,
    )


class RecoveryCodesResponseSerializer(serializers.Serializer[Any]):
    codes = serializers.ListField(
        child=serializers.CharField(),
        read_only=True,
    )
