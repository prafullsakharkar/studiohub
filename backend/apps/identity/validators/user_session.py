from django.core.exceptions import ValidationError
from django.utils import timezone


class UserSessionValidator:

    @staticmethod
    def validate_not_expired(session):

        if session.expires_at <= timezone.now():
            raise ValidationError("Session has expired.")

    @staticmethod
    def validate_not_revoked(session):

        if session.is_revoked:
            raise ValidationError("Session has already been revoked.")
