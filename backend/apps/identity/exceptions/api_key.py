from .base import IdentityException


class APIKeyException(IdentityException):
    default_code = "api_key_error"


class InvalidAPIKey(APIKeyException):
    default_code = "invalid_api_key"

    default_message = "Invalid API Key."


class ExpiredAPIKey(APIKeyException):
    default_code = "expired_api_key"

    default_message = "API Key has expired."


class InactiveAPIKey(APIKeyException):
    default_code = "inactive_api_key"

    default_message = "API Key is inactive."


class RevokedAPIKey(APIKeyException):
    default_code = "revoked_api_key"

    default_message = "API Key has been revoked."
