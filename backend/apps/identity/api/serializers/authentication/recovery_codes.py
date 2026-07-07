from rest_framework import serializers


class RecoveryCodeVerifySerializer(serializers.Serializer):
    code = serializers.CharField(
        max_length=32,
    )


class RecoveryCodesResponseSerializer(serializers.Serializer):
    codes = serializers.ListField(
        child=serializers.CharField(),
        read_only=True,
    )
