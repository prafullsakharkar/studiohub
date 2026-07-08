from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.identity.api_keys import APIKeyUtils
from apps.identity.models import APIKey
from apps.identity.selectors import APIKeySelector
from apps.identity.services.base import IdentityBaseService
from apps.identity.validators import APIKeyValidator


class APIKeyService(IdentityBaseService):
    model = APIKey

    selector = APIKeySelector

    validator = APIKeyValidator

    @classmethod
    @transaction.atomic
    def create(
        cls,
        *,
        organization,
        created_by,
        name,
        scopes=None,
        expires_at=None,
        description="",
    ):
        scopes = scopes or []

        token = APIKeyUtils.generate()

        cls.validator.validate_name_unique(
            organization=organization,
            name=name,
        )

        instance = cls.create_instance(
            organization=organization,
            created_by=created_by,
            name=name,
            description=description,
            prefix=token["prefix"],
            hashed_key=token["hashed"],
            scopes=scopes,
            expires_at=expires_at,
            is_active=True,
        )

        return instance, token["token"]

    @classmethod
    @transaction.atomic
    def revoke(
        cls,
        api_key,
    ):
        return cls.update_instance(
            api_key,
            is_active=False,
        )

    @classmethod
    @transaction.atomic
    def activate(
        cls,
        api_key,
    ):
        return cls.update_instance(
            api_key,
            is_active=True,
        )

    @classmethod
    @transaction.atomic
    def touch(
        cls,
        api_key,
        ip_address=None,
    ):
        return cls.update_instance(
            api_key,
            last_used_at=timezone.now(),
            last_used_ip=ip_address,
        )

    @classmethod
    def verify(
        cls,
        token: str,
    ):
        prefix = token.split(".", 1)[0]

        api_key = cls.selector.get_by_prefix(prefix)

        if api_key is None:
            return None

        cls.validator.validate(api_key)

        if not APIKeyUtils.verify(
            token,
            api_key.hashed_key,
        ):
            return None

        return api_key
