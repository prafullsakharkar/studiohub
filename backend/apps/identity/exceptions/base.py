from apps.core.api.exceptions import BaseAPIException


class IdentityException(BaseAPIException):
    """
    Base exception for Identity module.
    """

    default_code = "identity_error"

    default_message = "Identity operation failed."
