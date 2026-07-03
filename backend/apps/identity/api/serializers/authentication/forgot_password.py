from rest_framework import serializers

from apps.identity.services.password import (
    PasswordService,
)


class ForgotPasswordSerializer(serializers.Serializer):

    email = serializers.EmailField()

    def save(self, **kwargs):

        PasswordService.request_password_reset(
            self.validated_data["email"],
        )
