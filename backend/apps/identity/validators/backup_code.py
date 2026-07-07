from django.utils import timezone

from apps.core.validators import BaseValidator
from apps.identity.models import BackupCode


class BackupCodeValidator(BaseValidator):
    model = BackupCode

    @classmethod
    def validate_use(cls, code: BackupCode):
        cls.check_not_none(code, "Backup code not found.")

        if code.used:
            cls.raise_validation_error("Backup code has already been used.")

        if code.expires_at and code.expires_at <= timezone.now():
            cls.raise_validation_error("Backup code has expired.")
