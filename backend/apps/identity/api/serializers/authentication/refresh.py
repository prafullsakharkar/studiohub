from rest_framework import serializers

from apps.identity.services.authentication import (
    AuthenticationService,
)


class RefreshTokenSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def save(self, **kwargs):
        return AuthenticationService.refresh(
            refresh_token=self.validated_data["refresh"],
        )
