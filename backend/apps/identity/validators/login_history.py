from django.core.exceptions import ValidationError


class LoginHistoryValidator:

    @staticmethod
    def validate_failure_reason(status, reason):

        if status == "failed" and not reason:
            raise ValidationError("Failure reason is required.")
