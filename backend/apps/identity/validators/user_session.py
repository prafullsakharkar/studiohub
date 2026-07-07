from django.utils import timezone

from apps.identity.choices import SessionStatus
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class UserSessionValidator(
    IdentityBaseValidator,
):
    """
    Validator for UserSession.
    """

    @classmethod
    def validate_active(
        cls,
        session,
    ):
        if session.status != SessionStatus.ACTIVE:
            raise ValueError(
                "Session is not active.",
            )

    @classmethod
    def validate_not_expired(
        cls,
        session,
    ):
        if session.expires_at and session.expires_at <= timezone.now():
            raise ValueError(
                "Session has expired.",
            )

    @classmethod
    def validate_refresh(
        cls,
        session,
    ):
        cls.validate_active(
            session,
        )
        cls.validate_not_expired(
            session,
        )

    @classmethod
    def validate_logout(
        cls,
        session,
    ):
        cls.validate_active(
            session,
        )
