from rest_framework import serializers

from apps.identity.models import User
from apps.identity.services.email import (
    EmailService,
)


class VerifyEmailSerializer(serializers.Serializer):

    token = serializers.CharField()

    def save(self, **kwargs):

        user = User.objects.get_by_verification_token(
            self.validated_data["token"],
        )

        return EmailService.verify_email(
            user,
        )
