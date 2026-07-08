from __future__ import annotations

from django.utils import timezone

from apps.identity.selectors import (
    PersonalAccessTokenSelector,
)
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class PersonalAccessTokenValidator(
    IdentityBaseValidator,
):
    selector = PersonalAccessTokenSelector

    @classmethod
    def validate_name_unique(
        cls,
        *,
        user,
        name: str,
    ):
        cls.ensure(
            not cls.selector.get_by_user(user).filter(name=name).exists(),
            "Token with this name already exists.",
        )

    @classmethod
    def validate_prefix_unique(
        cls,
        prefix: str,
    ):
        cls.ensure(
            cls.selector.get_by_prefix(prefix) is None,
            "Token prefix already exists.",
        )

    @classmethod
    def validate_active(
        cls,
        token,
    ):
        cls.ensure(
            token.is_active,
            "Token has been revoked.",
        )

    @classmethod
    def validate_not_expired(
        cls,
        token,
    ):
        if token.expires_at:
            cls.ensure(
                token.expires_at > timezone.now(),
                "Token has expired.",
            )

    @classmethod
    def validate_scope(
        cls,
        token,
        scope: str,
    ):
        cls.ensure(
            scope in token.scopes,
            "Insufficient token scope.",
        )

    @classmethod
    def validate(
        cls,
        token,
    ):
        cls.validate_active(token)
        cls.validate_not_expired(token)
