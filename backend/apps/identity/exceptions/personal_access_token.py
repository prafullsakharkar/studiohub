from .base import IdentityException


class PersonalAccessTokenException(IdentityException):
    default_code = "personal_access_token_error"


class InvalidPersonalAccessToken(
    PersonalAccessTokenException,
):
    default_code = "invalid_personal_access_token"

    default_message = "Invalid Personal Access Token."


class ExpiredPersonalAccessToken(
    PersonalAccessTokenException,
):
    default_code = "expired_personal_access_token"

    default_message = "Personal Access Token has expired."


class InactivePersonalAccessToken(
    PersonalAccessTokenException,
):
    default_code = "inactive_personal_access_token"

    default_message = "Personal Access Token is inactive."
