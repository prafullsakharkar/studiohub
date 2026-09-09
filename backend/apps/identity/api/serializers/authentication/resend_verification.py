from typing import Any

from rest_framework import serializers

from apps.identity.services.email import (
    EmailService,
)


class ResendVerificationSerializer(
    serializers.Serializer[Any],
):

    email = serializers.EmailField()

    def save(self, **kwargs):

        user = self.context["request"].user

        EmailService.send_verification_email(
            user,
        )
