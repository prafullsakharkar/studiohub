from rest_framework import serializers

from apps.identity.services.password import (
    PasswordService,
)


class ResetPasswordSerializer(serializers.Serializer):

    token = serializers.CharField()

    password = serializers.CharField()

    def save(self, **kwargs):

        PasswordService.reset_password(
            token=self.validated_data["token"],
            password=self.validated_data["password"],
        )
