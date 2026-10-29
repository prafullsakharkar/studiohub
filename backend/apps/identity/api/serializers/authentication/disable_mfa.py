from typing import Any

from rest_framework import serializers


class MFAReauthSerializer(serializers.Serializer[Any]):
    """
    Re-authentication for a sensitive MFA change: the password, plus a TOTP
    code or a recovery code when MFA is enabled.
    """

    password = serializers.CharField(
        write_only=True,
        style={
            "input_type": "password",
        },
    )

    code = serializers.CharField(
        max_length=10,
        required=False,
        allow_blank=True,
        default="",
        write_only=True,
    )

    recovery_code = serializers.CharField(
        max_length=32,
        required=False,
        allow_blank=True,
        default="",
        write_only=True,
    )


class MFADisableSerializer(MFAReauthSerializer):
    pass
