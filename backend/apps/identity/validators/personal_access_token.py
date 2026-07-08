from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.identity.models import (
    PersonalAccessToken,
)

from .base import IdentityBaseValidator


class PersonalAccessTokenValidator(
    IdentityBaseValidator,
):
    model = PersonalAccessToken

    @classmethod
    def validate_create(
        cls,
        **validated_data,
    ):
        user = validated_data.get(
            "user",
        )

        name = validated_data.get(
            "name",
        )

        if PersonalAccessToken.objects.filter(
            user=user,
            name=name,
        ).exists():
            raise ValidationError(
                {
                    "name": "Token with this name already exists.",
                },
            )

    @classmethod
    def validate_update(
        cls,
        instance,
        **validated_data,
    ):
        name = validated_data.get(
            "name",
        )

        if not name:
            return

        exists = (
            PersonalAccessToken.objects.filter(
                user=instance.user,
                name=name,
            )
            .exclude(
                pk=instance.pk,
            )
            .exists()
        )

        if exists:
            raise ValidationError(
                {
                    "name": "Token with this name already exists.",
                },
            )

    @classmethod
    def validate_activate(
        cls,
        instance,
        **kwargs,
    ):
        if instance.expired:
            raise ValidationError(
                "Cannot activate an expired token.",
            )

    @classmethod
    def validate_regenerate(
        cls,
        instance,
        **kwargs,
    ):
        if not instance.is_active:
            raise ValidationError(
                "Token is inactive.",
            )

    @classmethod
    def validate_use(
        cls,
        instance,
        **kwargs,
    ):
        if not instance.is_active:
            raise ValidationError(
                "Token is inactive.",
            )

        if instance.expired:
            raise ValidationError(
                "Token has expired.",
            )
