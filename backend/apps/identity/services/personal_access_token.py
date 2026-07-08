# apps/identity/services/personal_access_token.py

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.core.services.business import BusinessService
from apps.identity.api_keys import APIKeyUtils
from apps.identity.events import (
    PersonalAccessTokenActivated,
    PersonalAccessTokenCreated,
    PersonalAccessTokenRegenerated,
    PersonalAccessTokenRevoked,
    PersonalAccessTokenUsed,
)
from apps.identity.models import PersonalAccessToken
from apps.identity.selectors import (
    PersonalAccessTokenSelector,
)
from apps.identity.validators import (
    PersonalAccessTokenValidator,
)


class PersonalAccessTokenService(
    BusinessService,
):
    """
    Business service for Personal Access Tokens.
    """

    model = PersonalAccessToken

    selector_class = PersonalAccessTokenSelector

    validator_class = PersonalAccessTokenValidator

    event_map = {
        BusinessService.CREATE: PersonalAccessTokenCreated,
        BusinessService.ACTIVATE: PersonalAccessTokenActivated,
        BusinessService.DEACTIVATE: PersonalAccessTokenRevoked,
        "regenerate": PersonalAccessTokenRegenerated,
        "use": PersonalAccessTokenUsed,
    }

    @classmethod
    @transaction.atomic
    def create(
        cls,
        *,
        user=None,
        **validated_data,
    ):
        generated = APIKeyUtils.generate()

        instance = super().create(
            user=user,
            prefix=generated["prefix"],
            hashed_token=generated["hashed"],
            **validated_data,
        )

        instance.plain_token = generated["token"]

        return instance

    @classmethod
    def verify(
        cls,
        token: str,
    ):
        try:
            prefix, _ = token.split(
                ".",
                1,
            )
        except ValueError:
            return None

        instance = cls.selector_class.get_by_prefix(
            prefix,
        )

        if instance is None:
            return None

        if not instance.is_active:
            return None

        if instance.expired:
            return None

        if not APIKeyUtils.verify(
            token=token,
            hashed=instance.hashed_token,
        ):
            return None

        return instance

    @classmethod
    @transaction.atomic
    def regenerate(
        cls,
        instance,
        *,
        user=None,
    ):
        generated = APIKeyUtils.generate()

        instance = super().update(
            instance,
            user=user,
            prefix=generated["prefix"],
            hashed_token=generated["hashed"],
        )

        instance.plain_token = generated["token"]

        cls.publish_event(
            "regenerate",
            instance=instance,
            user=user,
        )

        return instance

    @classmethod
    @transaction.atomic
    def touch(
        cls,
        instance,
        *,
        ip_address=None,
        user=None,
    ):
        instance.last_used_at = timezone.now()
        instance.last_used_ip = ip_address

        instance.save(
            update_fields=[
                "last_used_at",
                "last_used_ip",
            ],
        )

        cls.publish_event(
            "use",
            instance=instance,
            user=user,
        )

        return instance
