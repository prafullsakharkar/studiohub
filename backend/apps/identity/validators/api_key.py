from __future__ import annotations

from django.utils import timezone

from apps.identity.selectors import APIKeySelector
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class APIKeyValidator(IdentityBaseValidator):
    selector = APIKeySelector

    @classmethod
    def validate_name_unique(
        cls,
        *,
        organization,
        name: str,
    ):
        cls.ensure(
            not cls.selector.get_by_organization(
                organization,
            )
            .filter(
                name=name,
            )
            .exists(),
            "API key with this name already exists.",
        )

    @classmethod
    def validate_prefix_unique(
        cls,
        prefix: str,
    ):
        cls.ensure(
            cls.selector.get_by_prefix(prefix) is None,
            "API key prefix already exists.",
        )

    @classmethod
    def validate_active(
        cls,
        api_key,
    ):
        cls.ensure(
            api_key.is_active,
            "API key has been revoked.",
        )

    @classmethod
    def validate_not_expired(
        cls,
        api_key,
    ):
        if api_key.expires_at:
            cls.ensure(
                api_key.expires_at > timezone.now(),
                "API key has expired.",
            )

    @classmethod
    def validate_scope(
        cls,
        api_key,
        scope: str,
    ):
        cls.ensure(
            scope in api_key.scopes,
            "API key does not have the required scope.",
        )

    @classmethod
    def validate(
        cls,
        api_key,
    ):
        cls.validate_active(api_key)
        cls.validate_not_expired(api_key)
