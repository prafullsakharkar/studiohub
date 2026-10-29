
from rest_framework import serializers

from apps.identity.models import User
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

    def validate_email(
        self,
        value: str,
    ) -> str:
        """
        Reject an address that differs from an existing one only by case.

        The database enforces ``lower(email)`` uniqueness, but the field's own
        ``UniqueValidator`` compares case-sensitively, so ``NEW@x`` after ``new@x``
        passed validation and failed at the constraint as an unhandled 500 (CR-12).
        """
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("user with this email already exists.")

        return value

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
