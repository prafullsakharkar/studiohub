"""
Custom API exceptions.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import APIException


class BaseAPIException(APIException):
    """
    Base API exception.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Request failed."
    default_code = "request_failed"


class BadRequestException(BaseAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Bad request."
    default_code = "bad_request"


class ConflictException(BaseAPIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Conflict."
    default_code = "conflict"


class ResourceLockedException(BaseAPIException):
    status_code = status.HTTP_423_LOCKED
    default_detail = "Resource is locked."
    default_code = "resource_locked"


class ServiceUnavailableException(BaseAPIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Service unavailable."
    default_code = "service_unavailable"
