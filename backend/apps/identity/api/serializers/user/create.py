from rest_framework import serializers

from apps.identity.services.user import (
    UserService,
)

from .base import UserBaseSerializer


class UserCreateSerializer(
    UserBaseSerializer,
):

    password = serializers.CharField(
        write_only=True,
        required=True,
    )

    class Meta(
        UserBaseSerializer.Meta,
    ):
        fields = UserBaseSerializer.Meta.fields + ("password",)

    def validate_password(
        self,
        value,
    ):
        from apps.identity.validators.password import (
            validate_password,
        )

        validate_password(value)

        return value

    def create(
        self,
        validated_data,
    ):
        password = validated_data.pop(
            "password",
            None,
        )

        from apps.identity.services.user_password import (
            UserPasswordService,
        )

        user = UserService.create(
            **validated_data,
        )

        if password:
            UserPasswordService.set_password(
                user=user,
                password=password,
            )

        return user
