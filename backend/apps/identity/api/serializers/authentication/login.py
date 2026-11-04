from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework import serializers

from apps.identity.services.authentication import (
    AuthenticationService,
)


class LoginSerializer(
    serializers.Serializer[Any],
):
    # An e-mail for a local account, or a directory username (ADR-0039); the field keeps its name
    # for the existing clients, so it is no longer an EmailField.
    email = serializers.CharField(
        max_length=255,
    )

    password = serializers.CharField(
        write_only=True,
        style={
            "input_type": "password",
        },
    )

    organization = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    office = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    department = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    team = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    def validate_email(self, value):
        identifier = value.strip()

        if "@" in identifier:
            try:
                validate_email(identifier)
            except DjangoValidationError:
                raise serializers.ValidationError("Enter a valid email address.") from None

        return identifier

    def create(
        self,
        validated_data,
    ):
        request = self.context["request"]

        validated_data["username"] = validated_data.pop(
            "email",
        )

        return AuthenticationService.login(
            request=request,
            **validated_data,
        )
