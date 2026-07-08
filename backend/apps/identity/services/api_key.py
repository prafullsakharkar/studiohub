# apps/identity/services/api_key.py

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.core.services.business import BusinessService
from apps.identity.api_keys import APIKeyUtils
from apps.identity.events import (
    APIKeyActivated,
    APIKeyCreated,
    APIKeyRegenerated,
    APIKeyRevoked,
    APIKeyUsed,
)
from apps.identity.models import APIKey
from apps.identity.selectors import APIKeySelector
from apps.identity.validators import APIKeyValidator


class APIKeyService(BusinessService):
    """
    Business service for API Keys.
    """

    model = APIKey

    selector_class = APIKeySelector

    validator_class = APIKeyValidator

    event_map = {
        BusinessService.CREATE: APIKeyCreated,
        BusinessService.ACTIVATE: APIKeyActivated,
        BusinessService.DEACTIVATE: APIKeyRevoked,
        "regenerate": APIKeyRegenerated,
        "use": APIKeyUsed,
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
            hashed_key=generated["hashed"],
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
            prefix, _ = token.split(".", 1)
        except ValueError:
            return None

        instance = cls.selector_class.get_by_prefix(prefix)

        if instance is None:
            return None

        if not instance.is_active:
            return None

        if instance.expired:
            return None

        if not APIKeyUtils.verify(
            token=token,
            hashed=instance.hashed_key,
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
            hashed_key=generated["hashed"],
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
