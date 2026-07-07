from rest_framework import serializers


class MFADisableSerializer(serializers.Serializer):
    password = serializers.CharField(
        write_only=True,
    )
