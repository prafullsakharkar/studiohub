from rest_framework import serializers

from apps.identity.services.authentication import (
    AuthenticationService,
)


class LogoutSerializer(serializers.Serializer):
    """
    Logout serializer.
    """

    refresh = serializers.CharField()

    def save(self, **kwargs):
        AuthenticationService.logout(
            refresh_token=self.validated_data["refresh"],
        )
