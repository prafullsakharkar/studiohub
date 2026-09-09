from typing import Any

from rest_framework import serializers


class MFAVerifySerializer(serializers.Serializer[Any]):
    code = serializers.CharField(
        max_length=10,
    )

    remember_device = serializers.BooleanField(
        required=False,
        default=False,
    )
