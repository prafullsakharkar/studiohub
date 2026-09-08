from typing import Any

from rest_framework import serializers


class MFADisableSerializer(serializers.Serializer[Any]):
    password = serializers.CharField(
        write_only=True,
    )
