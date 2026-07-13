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

    def create(
        self,
        validated_data,
    ):
        password = validated_data.pop(
            "password",
            None,
        )

        user = UserService.create(
            **validated_data,
        )

        if password:
            UserService.set_password(
                user=user,
                password=password,
            )

        return user
