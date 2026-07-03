from rest_framework import serializers

from apps.identity.services.authentication import (
    AuthenticationService,
)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()

    password = serializers.CharField(
        write_only=True,
    )

    def create(self, validated_data):
        return AuthenticationService.login(
            **validated_data,
        )
