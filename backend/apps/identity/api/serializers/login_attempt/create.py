from rest_framework import serializers

from apps.identity.services.login_attempt import (
    LoginAttemptService,
)

from .base import LoginAttemptBaseSerializer


class LoginAttemptCreateSerializer(
    LoginAttemptBaseSerializer,
):

    REASON_CHOICES = (
        "invalid_credentials",
        "account_locked",
        "mfa_required",
        "success",
    )

    username = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    class Meta(
        LoginAttemptBaseSerializer.Meta,
    ):
        pass

    def validate_reason(
        self,
        value,
    ):
        if value and value not in self.REASON_CHOICES:
            from rest_framework import serializers

            raise serializers.ValidationError(
                "reason must be one of: "
                + ", ".join(self.REASON_CHOICES),
            )

        return value

    def create(
        self,
        validated_data,
    ):
        return LoginAttemptService.create(
            **validated_data,
        )
