from rest_framework import status
from rest_framework.exceptions import APIException

__all__ = ["PasswordManagedByDirectory"]


class PasswordManagedByDirectory(APIException):
    """A directory account's password is changed in the directory, never here (ADR-0039 decision 8)."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This account signs in through the directory; change the password there."
    default_code = "password_managed_by_directory"
