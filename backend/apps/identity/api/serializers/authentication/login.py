from rest_framework import serializers

from apps.identity.services.authentication import (
    AuthenticationService,
)


class LoginSerializer(
    serializers.Serializer,
):
    username = serializers.CharField(
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

    def create(
        self,
        validated_data,
    ):
        request = self.context["request"]

        return AuthenticationService.login(
            request=request,
            **validated_data,
        )
