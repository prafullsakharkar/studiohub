from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.identity.services.password_reset import PasswordResetService


class ResetPasswordSerializer(serializers.Serializer[Any]):
    """Consume a single-use reset token and set a new password."""

    token = serializers.CharField(
        write_only=True,
    )

    new_password = serializers.CharField(
        write_only=True,
    )

    confirm_password = serializers.CharField(
        write_only=True,
    )

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {
                    "confirm_password": "Passwords do not match.",
                }
            )

        return attrs

    def save(self, **kwargs):
        return PasswordResetService.confirm_reset(
            token=self.validated_data["token"],
            new_password=self.validated_data["new_password"],
            request=self.context.get("request"),
        )
