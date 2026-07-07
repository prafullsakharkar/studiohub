from rest_framework import serializers

from apps.identity.services.authentication import (
    AuthenticationService,
)


class RefreshSerializer(
    serializers.Serializer,
):
    refresh = serializers.CharField()

    def create(
        self,
        validated_data,
    ):
        return AuthenticationService.refresh(
            refresh_token=validated_data["refresh"],
        )
