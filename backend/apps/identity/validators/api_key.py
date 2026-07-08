from __future__ import annotations

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.identity.models import APIKey

from .base import IdentityBaseValidator


class APIKeyValidator(
    IdentityBaseValidator,
):
    model = APIKey

    @classmethod
    def validate_create(
        cls,
        **validated_data,
    ):
        organization = validated_data.get(
            "organization",
        )

        name = validated_data.get(
            "name",
        )

        if APIKey.objects.filter(
            organization=organization,
            name=name,
        ).exists():
            raise ValidationError(
                {
                    "name": "API Key with this name already exists.",
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
            APIKey.objects.filter(
                organization=instance.organization,
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
                    "name": "API Key with this name already exists.",
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
                "Cannot activate an expired API Key.",
            )

    @classmethod
    def validate_regenerate(
        cls,
        instance,
        **kwargs,
    ):
        if not instance.is_active:
            raise ValidationError(
                "API Key is inactive.",
            )

    @classmethod
    def validate_use(
        cls,
        instance,
        **kwargs,
    ):
        if not instance.is_active:
            raise ValidationError(
                "API Key is inactive.",
            )

        if instance.expired:
            raise ValidationError(
                "API Key has expired.",
            )
