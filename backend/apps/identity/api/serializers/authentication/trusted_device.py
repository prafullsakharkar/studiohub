from rest_framework import serializers


class TrustedDeviceSerializer(serializers.Serializer):
    remember = serializers.BooleanField(
        default=True,
    )


class TrustedDeviceRevokeSerializer(serializers.Serializer):
    device_id = serializers.UUIDField()
