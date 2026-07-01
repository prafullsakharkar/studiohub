"""
Validation exceptions.
"""

from __future__ import annotations

from rest_framework import status

from .api import BaseAPIException


class ValidationException(BaseAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Validation failed."
    default_code = "validation_error"


class DuplicateNameException(ValidationException):
    default_detail = "Name already exists."


class InvalidStateException(ValidationException):
    default_detail = "Invalid object state."
