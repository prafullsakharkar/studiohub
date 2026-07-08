from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.identity.api_keys import APIKeyUtils
from apps.identity.models import PersonalAccessToken
from apps.identity.selectors import (
    PersonalAccessTokenSelector,
)
from apps.identity.services.base import IdentityBaseService
from apps.identity.validators import (
    PersonalAccessTokenValidator,
)


class PersonalAccessTokenService(
    IdentityBaseService,
):
    model = PersonalAccessToken

    selector = PersonalAccessTokenSelector

    validator = PersonalAccessTokenValidator

    @classmethod
    @transaction.atomic
    def create(
        cls,
        *,
        user,
        name,
        scopes=None,
        expires_at=None,
    ):
        scopes = scopes or []

        token = APIKeyUtils.generate()

        cls.validator.validate_name_unique(
            user=user,
            name=name,
        )

        instance = cls.create_instance(
            user=user,
            name=name,
            prefix=token["prefix"],
            hashed_token=token["hashed"],
            scopes=scopes,
            expires_at=expires_at,
            is_active=True,
        )

        return instance, token["token"]

    @classmethod
    @transaction.atomic
    def revoke(
        cls,
        token,
    ):
        return cls.update_instance(
            token,
            is_active=False,
        )

    @classmethod
    @transaction.atomic
    def activate(
        cls,
        token,
    ):
        return cls.update_instance(
            token,
            is_active=True,
        )

    @classmethod
    @transaction.atomic
    def touch(
        cls,
        token,
        ip_address=None,
    ):
        return cls.update_instance(
            token,
            last_used_at=timezone.now(),
            last_used_ip=ip_address,
        )

    @classmethod
    def verify(
        cls,
        token_string: str,
    ):
        prefix = token_string.split(".", 1)[0]

        token = cls.selector.get_by_prefix(prefix)

        if token is None:
            return None

        cls.validator.validate(token)

        if not APIKeyUtils.verify(
            token_string,
            token.hashed_token,
        ):
            return None

        return token
