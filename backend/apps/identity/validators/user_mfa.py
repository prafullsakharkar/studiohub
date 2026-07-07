from django.utils import timezone

from apps.core.validators import BaseValidator
from apps.identity.models import UserMFA


class UserMFAValidator(BaseValidator):
    model = UserMFA

    @classmethod
    def validate_enable(cls, mfa: UserMFA):
        cls.check_not_none(mfa, "MFA configuration does not exist.")

        if mfa.enabled:
            cls.raise_validation_error("MFA is already enabled.")

    @classmethod
    def validate_disable(cls, mfa: UserMFA):
        cls.check_not_none(mfa, "MFA configuration does not exist.")

        if not mfa.enabled:
            cls.raise_validation_error("MFA is already disabled.")

    @classmethod
    def validate_verify(cls, mfa: UserMFA):
        cls.check_not_none(mfa, "MFA configuration does not exist.")

        if not mfa.enabled:
            cls.raise_validation_error("MFA is not enabled.")

        if mfa.locked_until and mfa.locked_until > timezone.now():
            cls.raise_validation_error("MFA verification is temporarily locked.")
