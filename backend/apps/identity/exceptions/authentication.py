from .base import IdentityException


class AuthenticationException(
    IdentityException,
):
    default_code = "authentication_error"


class InvalidCredentials(
    AuthenticationException,
):
    default_code = "invalid_credentials"

    default_message = "Invalid credentials."


class AccountLocked(
    AuthenticationException,
):
    default_code = "account_locked"

    default_message = "Account is locked."


class EmailNotVerified(
    AuthenticationException,
):
    default_code = "email_not_verified"

    default_message = "Email address is not verified."
