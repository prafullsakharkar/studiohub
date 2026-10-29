from apps.identity.choices.mfa import MFAStatus
from apps.identity.models import UserMFA
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class UserMFAValidator(IdentityBaseValidator):
    model = UserMFA

    @classmethod
    def validate_enable(cls, mfa: UserMFA):
        cls.check_not_none(mfa, "MFA configuration does not exist.")

        if mfa.status in (MFAStatus.ENABLED, MFAStatus.LOCKED):
            cls.raise_validation_error("MFA is already enabled.")

    @classmethod
    def validate_enrollable(cls, mfa: UserMFA | None):
        """Enrolling never overwrites a live second factor."""
        if mfa is not None and mfa.status in (MFAStatus.ENABLED, MFAStatus.LOCKED):
            cls.raise_validation_error("MFA is already enabled.")

    @classmethod
    def validate_pending(cls, mfa: UserMFA | None):
        cls.check_not_none(mfa, "MFA enrollment has not been started.")

        assert mfa is not None

        if mfa.status != MFAStatus.PENDING:
            cls.raise_validation_error("MFA enrollment has not been started.")

    @classmethod
    def validate_disable(cls, mfa: UserMFA):
        cls.check_not_none(mfa, "MFA configuration does not exist.")

        if mfa.status not in (MFAStatus.ENABLED, MFAStatus.LOCKED):
            cls.raise_validation_error("MFA is already disabled.")

    @classmethod
    def validate_disable_or_pending(cls, mfa: UserMFA | None):
        """A pending enrollment can be abandoned as well as an active one."""
        cls.check_not_none(mfa, "MFA configuration does not exist.")

        assert mfa is not None

        if mfa.status == MFAStatus.DISABLED:
            cls.raise_validation_error("MFA is already disabled.")

    @classmethod
    def validate_verify(cls, mfa: UserMFA | None):
        cls.check_not_none(mfa, "MFA configuration does not exist.")

        assert mfa is not None

        if mfa.status not in (MFAStatus.ENABLED, MFAStatus.LOCKED):
            cls.raise_validation_error("MFA is not enabled.")
