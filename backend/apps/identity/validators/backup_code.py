from django.utils import timezone

from apps.identity.models import BackupCode
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class BackupCodeValidator(IdentityBaseValidator):
    model = BackupCode

    @classmethod
    def validate_use(cls, code: BackupCode):
        cls.check_not_none(code, "Backup code not found.")

        if code.used:
            cls.raise_validation_error("Backup code has already been used.")

        if code.expires_at and code.expires_at <= timezone.now():
            cls.raise_validation_error("Backup code has expired.")
