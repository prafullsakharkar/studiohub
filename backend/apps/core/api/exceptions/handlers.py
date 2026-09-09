"""
Global DRF exception handler.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, PermissionDenied
from rest_framework.response import Response
from rest_framework.serializers import as_serializer_error
from rest_framework.views import exception_handler

from apps.core.exceptions.base import BaseDomainException


def custom_exception_handler(exc, context):
    """
    Standardize all DRF exception responses.

    Returns raw DRF error bodies (``{"detail": ...}`` / field-error maps /
    ``{"non_field_errors": [...]}``) with no envelope, matching the frontend
    API contract (``ApiError.fromDrfResponse``).
    """

    if isinstance(exc, BaseDomainException):
        return Response(
            {"detail": exc.message},
            status=exc.status_code,
        )

    # Service-layer validators raise Django's ValidationError, which DRF
    # does not handle — without this mapping every business-rule failure
    # would surface as a 500 instead of a 400.
    if isinstance(exc, DjangoValidationError):
        return Response(
            as_serializer_error(exc),
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Database-level uniqueness/ integrity races that slip past
    # validators are conflicts (409), not server errors (500).
    if isinstance(exc, IntegrityError):
        return Response(
            {"detail": "Resource conflict: the request conflicts with existing data."},
            status=status.HTTP_409_CONFLICT,
        )

    response = exception_handler(exc, context)

    if response is None:
        return Response(
            {"detail": "Internal server error."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # DRF coerces ``AuthenticationFailed``/``NotAuthenticated`` to 403 when
    # the view cannot issue a WWW-Authenticate header (e.g. login views
    # without authenticators), and views without authenticators raise
    # ``PermissionDenied`` instead of ``NotAuthenticated``. The API contract
    # treats authentication failures as 401.
    if isinstance(
        exc,
        (AuthenticationFailed, NotAuthenticated),
    ) and response.status_code == status.HTTP_403_FORBIDDEN:
        response.status_code = status.HTTP_401_UNAUTHORIZED
    elif (
        isinstance(exc, PermissionDenied)
        and response.status_code == status.HTTP_403_FORBIDDEN
    ):
        request = context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            response.status_code = status.HTTP_401_UNAUTHORIZED

    return response
