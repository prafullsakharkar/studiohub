from typing import Any

from rest_framework import serializers


class MFAVerifySerializer(serializers.Serializer[Any]):
    code = serializers.CharField(
        max_length=10,
    )

    remember_device = serializers.BooleanField(
        required=False,
        default=False,
    )


class MFAChallengeSerializer(serializers.Serializer[Any]):
    """
    Second step of an MFA login: the challenge from the password step plus
    a TOTP code or a recovery code.
    """

    challenge = serializers.CharField(
        max_length=512,
    )

    code = serializers.CharField(
        max_length=10,
        required=False,
        allow_blank=True,
        default="",
    )

    recovery_code = serializers.CharField(
        max_length=32,
        required=False,
        allow_blank=True,
        default="",
    )

    remember_device = serializers.BooleanField(
        required=False,
        default=False,
    )

    def validate(self, attrs):
        if not attrs.get("code") and not attrs.get("recovery_code"):
            raise serializers.ValidationError(
                "Provide a verification code or a recovery code.",
            )

        return attrs
