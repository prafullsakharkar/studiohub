from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class LoginAttemptValidator(
    IdentityBaseValidator,
):

    MAX_ATTEMPTS = 5

    @classmethod
    def validate_attempts(
        cls,
        attempts,
    ):

        if attempts >= cls.MAX_ATTEMPTS:
            from apps.identity.authentication.exceptions import (
                AccountLocked,
            )

            raise AccountLocked()
