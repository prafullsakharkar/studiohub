from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class UserSessionValidator(
    IdentityBaseValidator,
):

    @staticmethod
    def validate_not_expired(session):

        if session.expires_at <= timezone.now():
            raise ValidationError("Session has expired.")

    @staticmethod
    def validate_not_revoked(session):

        if session.is_revoked:
            raise ValidationError("Session has already been revoked.")
