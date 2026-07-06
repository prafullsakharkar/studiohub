from django.core.exceptions import ValidationError

from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class LoginHistoryValidator(
    IdentityBaseValidator,
):

    @staticmethod
    def validate_failure_reason(status, reason):

        if status == "failed" and not reason:
            raise ValidationError("Failure reason is required.")
